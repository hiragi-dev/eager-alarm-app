#!/usr/bin/env node
/**
 * eager-alarm-edge の挙動を模擬するモック。実機無しでアプリ側の
 * add/delete/list/pause/stop コマンドの往復・鳴動状態の遷移を確認するためのテストツール。
 *
 * 使い方:
 *   npm run mock:edge
 * （内部で `node --env-file=.env.local mock/edge-mock.mjs` を実行し、
 *   アプリと同じ .env.local の接続情報・デバイスIDを使う）
 *
 * 実装している状態遷移（現状の eager-alarm-edge にはまだ無い pause/stop/status も含む、
 * 合意済みAPI仕様の参照実装）:
 *   - スケジュール済みのアラームは wakeup_time 順に並べ、時刻が来たら「鳴動中」に遷移する
 *   - pause: muted_until を「上書き」で延長する（積算しない）。歩行検知中の再送を想定
 *   - stop: 鳴動中のアラームを完全に停止し、muted_until もクリアする
 *   - status: 生存確認コマンド。受信したら status トピックへ即座に応答する
 *     （アプリ側は応答の有無だけでオンライン/オフラインを判定するため、内容は最小限）
 *   - 鳴動中はハートビートログを一定間隔で出し、ミュート中は静かにする
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

const TICK_MS = 500;
const RINGING_HEARTBEAT_MS = 2000;

/** @typedef {{ id: string, wakeupTime: Date }} Alarm */

/** @type {Alarm[]} 未鳴動のアラーム。常に wakeupTime 昇順を保つ */
let schedule = [];
/** @type {Alarm | null} 現在鳴動中のアラーム */
let ringing = null;
/** @type {Date | null} この時刻までは鳴動(への遷移・継続)を抑制する */
let mutedUntil = null;
let lastHeartbeatAt = 0;

function log(...args) {
  const time = new Date().toLocaleTimeString("ja-JP", { hour12: false });
  console.log(`[${time}]`, ...args);
}

/** chrono の DateTime<Local> が RFC3339 で出力する形式（ローカルオフセット付き）に合わせる */
function toLocalRfc3339(date) {
  const pad = (n) => String(n).padStart(2, "0");
  const offsetMin = -date.getTimezoneOffset();
  const sign = offsetMin >= 0 ? "+" : "-";
  const abs = Math.abs(offsetMin);
  const offset = `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}${offset}`
  );
}

/** RFC3339（オフセット付き）と "YYYY-MM-DD HH:MM:SS"（ローカル時刻扱い）のどちらも受け付ける */
function parseWakeupTime(raw) {
  const iso = raw.includes("T") ? raw : raw.replace(" ", "T");
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) throw new Error(`invalid wakeup_time: ${raw}`);
  return d;
}

function insertSorted(alarm) {
  schedule.push(alarm);
  schedule.sort((a, b) => a.wakeupTime.getTime() - b.wakeupTime.getTime());
}

function serializeAlarms(alarms) {
  return alarms.map((a) => ({ id: a.id, wakeup_time: toLocalRfc3339(a.wakeupTime) }));
}

function publishAlarms(client) {
  const payload = JSON.stringify(serializeAlarms(schedule));
  client.publish(ALARMS_TOPIC, payload, { qos: 2 }, (err) => {
    if (err) log(`⚠ alarms送信失敗: ${err.message}`);
    else log(`→ ${ALARMS_TOPIC}: ${payload}`);
  });
}

function handleCommand(client, cmd) {
  switch (cmd.type) {
    case "add": {
      try {
        const wakeupTime = parseWakeupTime(cmd.wakeup_time);
        const alarm = { id: randomUUID(), wakeupTime };
        insertSorted(alarm);
        log(`✅ add id=${alarm.id} wakeup_time=${toLocalRfc3339(wakeupTime)}`);
      } catch (err) {
        log(`⚠ add失敗: ${err.message}`);
      }
      break;
    }
    case "delete": {
      const before = schedule.length;
      schedule = schedule.filter((a) => a.id !== cmd.id);
      if (ringing?.id === cmd.id) {
        log(`🛑 鳴動中のアラーム id=${cmd.id} が delete されたため停止します`);
        ringing = null;
      }
      log(
        before === schedule.length
          ? `⚠ delete: id=${cmd.id} は見つかりませんでした`
          : `✅ delete id=${cmd.id}`,
      );
      break;
    }
    case "list": {
      log(`📋 list (${schedule.length}件)`);
      publishAlarms(client);
      break;
    }
    case "pause": {
      const durationMs = Number(cmd.duration_ms);
      if (!Number.isFinite(durationMs) || durationMs <= 0) {
        log(`⚠ pause: 不正な duration_ms=${cmd.duration_ms}`);
        break;
      }
      mutedUntil = new Date(Date.now() + durationMs);
      log(
        `😴 pause: ${durationMs}ms 停止 (muted_until=${mutedUntil.toLocaleTimeString("ja-JP", { hour12: false })})`,
      );
      break;
    }
    case "stop": {
      if (ringing) {
        log(`🛑 stop: 鳴動中のアラーム id=${ringing.id} を完全停止しました`);
      } else {
        log("🛑 stop: 現在鳴動中のアラームはありません");
      }
      ringing = null;
      mutedUntil = null;
      break;
    }
    case "status": {
      const payload = JSON.stringify({ online: true });
      client.publish(STATUS_TOPIC, payload, { qos: 2 }, (err) => {
        if (err) log(`⚠ status応答送信失敗: ${err.message}`);
        else log(`💓 status応答 → ${STATUS_TOPIC}: ${payload}`);
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

  if (!ringing && schedule.length > 0 && !muted) {
    const next = schedule[0];
    if (now >= next.wakeupTime) {
      ringing = next;
      schedule = schedule.slice(1);
      log(`🔔🔔🔔 ALARM RINGING id=${ringing.id} wakeup_time=${toLocalRfc3339(ringing.wakeupTime)}`);
      lastHeartbeatAt = 0;
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
