#!/usr/bin/env node
/**
 * eager-alarm-edge の挙動を模擬するモック (v2 API対応)。実機無しでアプリ側の
 * add/edit/delete/list/pause/stop コマンドの往復・鳴動状態の遷移を確認するためのテストツール。
 *
 * 使い方:
 *   npm run mock:edge
 * （内部で `node --env-file=.env.local mock/edge-mock.mjs` を実行し、
 *   アプリと同じ .env.local の接続情報・デバイスIDを使う）
 *
 * v2 変更点:
 *   - アラームは `time` (HH:MM) + `days_of_week` + `is_enabled` + `stop_method_id` で管理
 *   - add: id はエッジ（モック）側で生成
 *   - edit: 既存アラームを更新
 *   - stop: アラームは削除しない。次回の曜日に再スケジュール
 *   - stop_method_id: ブラウザ側(StopMethodProvider)が管理する位置情報ベースの停止方法の
 *     IDをそのまま保持して返すだけの不透明な値。エッジ側はこの値の意味を解釈しない
 */
import { randomUUID } from "node:crypto";
import mqtt from "mqtt";

const BROKER_URL = process.env.NEXT_PUBLIC_MQTT_BROKER_URL;
const USERNAME = process.env.NEXT_PUBLIC_MQTT_USERNAME;
const PASSWORD = process.env.NEXT_PUBLIC_MQTT_PASSWORD;
const DEVICE_ID = process.env.NEXT_PUBLIC_MQTT_DEVICE_ID || "pi";

if (!BROKER_URL) {
  console.error(
    "NEXT_PUBLIC_MQTT_BROKER_URL が未設定です。.env.local を用意してから `npm run mock:edge` を実行してください。",
  );
  process.exit(1);
}

const TOPIC_PREFIX = "eager-alarm";
const COMMAND_TOPIC = `${TOPIC_PREFIX}/${DEVICE_ID}/command`;
const ALARMS_TOPIC = `${TOPIC_PREFIX}/${DEVICE_ID}/alarms`;
const STATUS_TOPIC = `${TOPIC_PREFIX}/${DEVICE_ID}/status`;
const RINGING_STATUS_TOPIC = `${TOPIC_PREFIX}/${DEVICE_ID}/ringing_status`;

const TICK_MS = 500;
const RINGING_HEARTBEAT_MS = 2000;

const DAY_MAP = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

/**
 * @typedef {{ id: string, time: string, days_of_week: string[], is_enabled: boolean, stop_method_id: string | null, is_nfc_enabled: boolean, is_nfc_verified: boolean }} Alarm
 */

/** @type {Alarm[]} */
let alarmList = [];
/** @type {Alarm | null} 現在鳴動中のアラーム */
let ringing = null;
/** @type {Date | null} この時刻までは鳴動(への遷移・継続)を抑制する */
let mutedUntil = null;
let lastHeartbeatAt = 0;

function log(...args) {
  const time = new Date().toLocaleTimeString("ja-JP", { hour12: false });
  console.log(`[${time}]`, ...args);
}

/**
 * 次回の鳴動予定を計算する。
 * 現在時刻から最も近い鳴動予定日時を返す。
 * @param {Alarm} alarm
 * @returns {Date | null}
 */
function nextRingDate(alarm) {
  if (!alarm.is_enabled || alarm.days_of_week.length === 0) return null;

  const now = new Date();
  const [h, m] = alarm.time.split(":").map(Number);

  for (let offset = 0; offset < 8; offset++) {
    const candidate = new Date(now);
    candidate.setDate(candidate.getDate() + offset);
    candidate.setHours(h, m, 0, 0);

    // 今日の同じ時刻以降
    if (candidate <= now) continue;

    const dayName = Object.keys(DAY_MAP).find(k => DAY_MAP[k] === candidate.getDay());
    if (alarm.days_of_week.includes(dayName)) {
      return candidate;
    }
  }
  return null;
}

function publishAlarms(client) {
  // Serialize to v2 format
  const payload = JSON.stringify(
    alarmList.map(a => ({
      id: a.id,
      time: a.time,
      days_of_week: a.days_of_week,
      is_enabled: a.is_enabled,
      stop_method_id: a.stop_method_id,
      is_nfc_enabled: a.is_nfc_enabled,
      is_nfc_verified: a.is_nfc_verified,
    }))
  );
  client.publish(ALARMS_TOPIC, payload, { qos: 2 }, (err) => {
    if (err) log(`⚠ alarms送信失敗: ${err.message}`);
    else log(`→ ${ALARMS_TOPIC}: ${payload}`);
  });
}

function handleCommand(client, cmd) {
  switch (cmd.type) {
    case "add": {
      if (!cmd.time || !Array.isArray(cmd.days_of_week)) {
        log(`⚠ add: 不正なペイロード: ${JSON.stringify(cmd)}`);
        break;
      }
      const alarm = {
        id: randomUUID(),
        time: cmd.time,
        days_of_week: cmd.days_of_week,
        is_enabled: cmd.is_enabled ?? true,
        stop_method_id: cmd.stop_method_id ?? null,
        is_nfc_enabled: cmd.is_nfc_enabled,
        is_nfc_verified: false,
      };
      alarmList.push(alarm);
      alarmList.sort((a, b) => a.time.localeCompare(b.time));
      log(`✅ add id=${alarm.id} time=${alarm.time} days=[${alarm.days_of_week.join(",")}] stop_method_id=${alarm.stop_method_id}`);
      break;
    }
    case "edit": {
      const idx = alarmList.findIndex(a => a.id === cmd.id);
      if (idx === -1) {
        log(`⚠ edit: id=${cmd.id} は見つかりませんでした`);
        break;
      }
      alarmList[idx] = {
        id: cmd.id,
        time: cmd.time ?? alarmList[idx].time,
        days_of_week: cmd.days_of_week ?? alarmList[idx].days_of_week,
        is_enabled: cmd.is_enabled ?? alarmList[idx].is_enabled,
        stop_method_id: cmd.stop_method_id ?? alarmList[idx].stop_method_id,
        is_nfc_enabled: cmd.is_nfc_enabled ?? alarmList[idx].is_nfc_enabled,
        is_nfc_verified: false,
      };
      alarmList.sort((a, b) => a.time.localeCompare(b.time));
      log(`✅ edit id=${cmd.id} time=${alarmList[idx].time} enabled=${alarmList[idx].is_enabled} stop_method_id=${alarmList[idx].stop_method_id}`);
      break;
    }
    case "delete": {
      const before = alarmList.length;
      alarmList = alarmList.filter(a => a.id !== cmd.id);
      if (ringing?.id === cmd.id) {
        log(`🛑 鳴動中のアラーム id=${cmd.id} が delete されたため停止します`);
        ringing = null;
      }
      log(
        before === alarmList.length
          ? `⚠ delete: id=${cmd.id} は見つかりませんでした`
          : `✅ delete id=${cmd.id}`,
      );
      break;
    }
    case "list": {
      log(`📋 list (${alarmList.length}件)`);
      publishAlarms(client);
      break;
    }
    case "pause": {
      const durationMs = Number(cmd.duration_ms);
      if (!Number.isFinite(durationMs) || durationMs <= 0) {
        log(`⚠ pause: 不正な duration_ms=${cmd.duration_ms}`);
        break;
      }

      if (ringing) {
        if (ringing.is_nfc_enabled && !ringing.is_nfc_verified) {
          console.error("pause: attempt to pause NFC unverified alarm");
          process.exit(1);
        }

        mutedUntil = new Date(Date.now() + durationMs);
        log(
          `😴 pause: ${durationMs}ms 停止 (muted_until=${mutedUntil.toLocaleTimeString("ja-JP", { hour12: false })})`,
        );
      } else {
        console.error("pause: tried to pause empty alarm");
        process.exit(1);
      }

      break;
    }
    case "stop": {
      // v2: アラームは削除しない。ringing状態をクリアするだけ
      if (ringing) {
        if (ringing.is_nfc_enabled && !ringing.is_nfc_verified) {
          console.error("pause: attempt to pause NFC unverified alarm");
          process.exit(1);
        }

        log(`🛑 stop: 鳴動中のアラーム id=${ringing.id} を停止しました（アラームは保持）`);
        ringing.is_nfc_verified = false;

        ringing = null;
        mutedUntil = null;
      } else {
        log("🛑 stop: 現在鳴動中のアラームはありません");
      }
      break;
    }
    case "verify_nfc":
      if (ringing) {
        if (!ringing.is_nfc_enabled) {
          console.error("verify_nfc: you tried to verify nfc, but this alarm's nfc authentication is disabled!");
          process.exit(1);
        }

        if (ringing.is_nfc_verified) {
          console.warn("verify_nfc: you verified nfc twice!");
        }

        ringing.is_nfc_verified = true;
      } else {
        console.error("verify_nfc: attempt to verify empty alarm");
        process.exit(1);
      }

      break;
    case "status": {
      const payload = JSON.stringify({ online: true });
      client.publish(STATUS_TOPIC, payload, { qos: 2 }, (err) => {
        if (err) log(`⚠ status応答送信失敗: ${err.message}`);
        else log(`💓 status応答 → ${STATUS_TOPIC}: ${payload}`);
      });
      break;
    }
    case "ringing_status": {
      const payload = JSON.stringify({
        is_ringing: ringing !== null,
        ringing_ids: ringing ? [ringing.id] : [],
      });
      client.publish(RINGING_STATUS_TOPIC, payload, { qos: 2 }, (err) => {
        if (err) log(`⚠ ringing_status応答送信失敗: ${err.message}`);
      });
      break;
    }
    default:
      log(`⚠ 未知のコマンド: ${JSON.stringify(cmd)}`);
  }
}

function tick() {
  const now = new Date();
  const muted = mutedUntil != null && now < mutedUntil;

  // 鳴動していない場合: 有効なアラームのうち鳴動時刻を過ぎたものを探す
  if (!ringing && !muted) {
    const nowH = now.getHours();
    const nowM = now.getMinutes();
    const nowDay = Object.keys(DAY_MAP).find(k => DAY_MAP[k] === now.getDay());

    for (const alarm of alarmList) {
      if (!alarm.is_enabled) continue;
      if (!alarm.days_of_week.includes(nowDay)) continue;

      const [h, m] = alarm.time.split(":").map(Number);
      // 今の時刻と一致 (秒は±30秒以内で判定)
      if (h === nowH && m === nowM && now.getSeconds() < 30) {
        ringing = alarm;
        log(`🔔🔔🔔 ALARM RINGING id=${ringing.id} time=${ringing.time}`);
        lastHeartbeatAt = 0;
        break;
      }
    }
  }

  if (ringing) {
    if (muted) {
      // ミュート中は無音（ハートビートも出さない）
    } else if (now.getTime() - lastHeartbeatAt >= RINGING_HEARTBEAT_MS) {
      log(`🔔 鳴動中... id=${ringing.id}`);
      lastHeartbeatAt = now.getTime();
    }
  }
}

function main() {
  const client = mqtt.connect(BROKER_URL, {
    username: USERNAME || undefined,
    password: PASSWORD || undefined,
    clientId: `edge-mock-${Math.random().toString(16).slice(2, 8)}`,
    clean: true,
    connectTimeout: 8000,
  });

  client.on("connect", () => {
    log(`接続しました device=${DEVICE_ID} broker=${BROKER_URL}`);
    client.subscribe(COMMAND_TOPIC, { qos: 2 }, (err) => {
      if (err) {
        console.error("購読に失敗しました:", err.message);
        process.exit(1);
      }
      log(`購読開始: ${COMMAND_TOPIC} (QoS 2)`);
    });
  });

  client.on("message", (topic, payload) => {
    if (topic !== COMMAND_TOPIC) return;
    let cmd;
    try {
      cmd = JSON.parse(payload.toString());
    } catch {
      log(`⚠ 不正なペイロード: ${payload.toString()}`);
      return;
    }
    handleCommand(client, cmd);
  });

  client.on("error", (err) => {
    console.error("MQTTエラー:", err.message);
  });

  client.on("close", () => {
    log("切断されました");
  });

  const tickTimer = setInterval(tick, TICK_MS);

  process.on("SIGINT", () => {
    log("終了します…");
    clearInterval(tickTimer);
    client.end(true, () => process.exit(0));
  });
}

main();
