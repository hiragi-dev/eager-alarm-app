"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import type { IClientOptions, MqttClient } from "mqtt";
import {
  alarmsTopic,
  commandTopic,
  defaultSettings,
  envSettings,
  isDev,
  type MqttSettings,
  resolveInitialSettings,
  statusTopic,
  STORAGE_KEY,
} from "@/lib/mqtt";
import {
  buildAddCommand,
  buildDeleteCommand,
  buildListCommand,
  buildPauseCommand,
  buildStatusCommand,
  buildStopCommand,
  sortAlarmsByWakeupTime,
  type Alarm,
} from "@/lib/alarm";
import { useNotify } from "@/contexts/NotificationProvider";

export type MqttStatus = "disconnected" | "connecting" | "connected" | "error";
export type LogEntry = { time: string; text: string };

/**
 * unknown: ブローカー未接続、または接続直後でまだ生存確認できていない
 * online: statusコマンドへの応答をタイムアウト内に受信できている
 * offline: 応答がタイムアウトを超えて届いていない（ブローカーには接続できている）
 */
export type EdgeDeviceStatus = "unknown" | "online" | "offline";

const MAX_LOG = 30;
/** edgeデバイスへのstatusコマンド送信間隔 */
const STATUS_POLL_INTERVAL_MS = 5000;
/** この時間内に status トピックへの応答が無ければオフライン扱いにする */
const STATUS_OFFLINE_THRESHOLD_MS = 13000;

type MqttContextValue = {
  settings: MqttSettings;
  updateSetting: (key: keyof MqttSettings, value: string) => void;
  status: MqttStatus;
  edgeStatus: EdgeDeviceStatus;
  connect: () => void;
  disconnect: () => void;
  log: LogEntry[];
  sendPowerCommand: (command: "on" | "off") => void;
  alarms: Alarm[];
  alarmsUpdatedAt: number | null;
  requestAlarms: () => void;
  addAlarm: (wakeupTime: string) => void;
  deleteAlarm: (id: string) => void;
  sendPauseCommand: (durationMs: number) => void;
  sendStopCommand: () => void;
  envSeeded: boolean;
};

const MqttContext = createContext<MqttContextValue | null>(null);

/** MqttProvider配下でのみ使用可能。接続状態・設定・アラーム一覧を共有する */
export function useMqtt(): MqttContextValue {
  const ctx = useContext(MqttContext);
  if (!ctx) throw new Error("useMqtt must be used within MqttProvider");
  return ctx;
}

export default function MqttProvider({ children }: { children: React.ReactNode }) {
  const notify = useNotify();
  const [settings, setSettings] = useState<MqttSettings>(defaultSettings);
  const [status, setStatus] = useState<MqttStatus>("disconnected");
  const [edgeStatus, setEdgeStatus] = useState<EdgeDeviceStatus>("unknown");
  const [log, setLog] = useState<LogEntry[]>([]);
  const [alarms, setAlarms] = useState<Alarm[]>([]);
  const [alarmsUpdatedAt, setAlarmsUpdatedAt] = useState<number | null>(null);
  const clientRef = useRef<MqttClient | null>(null);
  const lastEdgeResponseAtRef = useRef<number | null>(null);

  const addLog = useCallback((text: string) => {
    const time = new Date().toLocaleTimeString("ja-JP", { hour12: false });
    setLog((prev) => [{ time, text }, ...prev].slice(0, MAX_LOG));
  }, []);

  // 初回マウント時: アプリUI(localStorage) > env(開発時のみ) > 既定値 の優先順で初期値を決定。
  // 認証情報はユーザーが編集したときだけ保存し、env値はバンドル/localStorageに固定しない。
  // deviceId のみ安定化のために保存する。
  useEffect(() => {
    let saved: Partial<MqttSettings> | null = null;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) saved = JSON.parse(raw);
    } catch {
      saved = null;
    }
    const merged = resolveInitialSettings(saved, envSettings());
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ ...(saved ?? {}), deviceId: merged.deviceId }),
      );
    } catch {
      // ignore storage errors
    }
    // localStorage/env からの初期復元（マウント時一度きり）
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSettings(merged);
  }, []);

  // アンマウント時に接続を確実に閉じる
  useEffect(() => {
    return () => {
      clientRef.current?.end(true);
      clientRef.current = null;
    };
  }, []);

  const updateSetting = useCallback((key: keyof MqttSettings, value: string) => {
    setSettings((prev) => {
      const next = { ...prev, [key]: value };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore storage errors
      }
      return next;
    });
  }, []);

  const connect = useCallback(async () => {
    if (clientRef.current) return;
    const s = settings;
    setStatus("connecting");
    addLog(`${s.brokerUrl} へ接続します…`);

    const mqtt = (await import("mqtt")).default;
    const options: IClientOptions = {
      clientId: `webapp-${Math.random().toString(16).slice(2, 10)}`,
      username: s.username || undefined,
      password: s.password || undefined,
      clean: true,
      connectTimeout: 8000,
      reconnectPeriod: 0,
    };

    const client = mqtt.connect(s.brokerUrl, options);
    clientRef.current = client;
    const sTopic = statusTopic(s.deviceId);
    const aTopic = alarmsTopic(s.deviceId);

    client.on("connect", () => {
      setStatus("connected");
      addLog("接続しました");
      client.subscribe([sTopic, aTopic], { qos: 2 }, (err) => {
        if (err) {
          addLog(`購読失敗: ${err.message}`);
          notify("error", `トピックの購読に失敗しました: ${err.message}`);
        } else {
          addLog(`購読開始: ${sTopic}, ${aTopic} (QoS 2)`);
        }
      });
    });

    client.on("message", (topic, payload) => {
      const text = payload.toString();
      addLog(`← ${topic}: ${text}`);
      if (topic === aTopic) {
        try {
          const parsed = JSON.parse(text) as Alarm[];
          setAlarms(sortAlarmsByWakeupTime(parsed));
          setAlarmsUpdatedAt(Date.now());
        } catch {
          addLog("アラーム一覧の解析に失敗しました");
        }
      }
      if (topic === sTopic) {
        // statusコマンドへの応答に限らず、statusトピックへの発信は
        // edgeデバイスが生存している証拠として扱う(旧ON/OFFデモのackも同様)
        lastEdgeResponseAtRef.current = Date.now();
        setEdgeStatus("online");
      }
    });

    client.on("error", (err) => {
      setStatus("error");
      setEdgeStatus("unknown");
      addLog(`エラー: ${err.message}`);
      notify("error", `MQTT接続エラー: ${err.message}`);
    });

    client.on("close", () => {
      setStatus((prev) => (prev === "error" ? prev : "disconnected"));
      setEdgeStatus("unknown");
    });
  }, [addLog, notify, settings]);

  const disconnect = useCallback(() => {
    clientRef.current?.end(true);
    clientRef.current = null;
    setStatus("disconnected");
    setEdgeStatus("unknown");
    addLog("切断しました");
  }, [addLog]);

  // アプリ起動時、ブローカーURL・デバイスIDが確定した時点(localStorage/envからの復元完了時)で
  // 一度だけ自動接続を試みる。以降は設定を編集しても再度自動接続はしない
  // （ユーザーが明示的に切断/再接続する操作を上書きしないため）。
  const autoConnectAttemptedRef = useRef(false);
  useEffect(() => {
    if (autoConnectAttemptedRef.current) return;
    if (!settings.brokerUrl || !settings.deviceId) return;
    autoConnectAttemptedRef.current = true;
    connect();
  }, [settings.brokerUrl, settings.deviceId, connect]);

  const publishCommand = useCallback(
    (payload: unknown) => {
      const client = clientRef.current;
      if (!client || status !== "connected") return;
      const topic = commandTopic(settings.deviceId);
      const text = JSON.stringify(payload);
      // QoS 2(Exactly Once)で送信し、アラーム操作が確実に一度だけデバイスへ届くことを保証する
      client.publish(topic, text, { qos: 2 }, (err) => {
        if (err) {
          addLog(`送信失敗: ${err.message}`);
          notify("error", `コマンドの送信に失敗しました: ${err.message}`);
        } else {
          addLog(`→ ${topic}: ${text}`);
        }
      });
    },
    [addLog, notify, status, settings.deviceId],
  );

  const sendPowerCommand = useCallback(
    (command: "on" | "off") => {
      publishCommand({ command, ts: Date.now() });
    },
    [publishCommand],
  );

  const requestAlarms = useCallback(() => {
    publishCommand(buildListCommand());
  }, [publishCommand]);

  const addAlarm = useCallback(
    (wakeupTime: string) => {
      publishCommand(buildAddCommand(wakeupTime));
      // add はエッジ側から一覧の自動返信が来ない前提のため、直後に list を送って更新する。
      // 同一パブリッシャー・同一トピックへの QoS1 publish は配信順序が保証されるため、
      // エッジ側は add を処理した後にこの list を受け取る。
      publishCommand(buildListCommand());
    },
    [publishCommand],
  );

  const deleteAlarm = useCallback(
    (id: string) => {
      publishCommand(buildDeleteCommand(id));
      publishCommand(buildListCommand());
    },
    [publishCommand],
  );

  const sendPauseCommand = useCallback(
    (durationMs: number) => {
      publishCommand(buildPauseCommand(durationMs));
    },
    [publishCommand],
  );

  const sendStopCommand = useCallback(() => {
    publishCommand(buildStopCommand());
  }, [publishCommand]);

  // 接続確立時に最新のアラーム一覧を自動取得する
  useEffect(() => {
    if (status === "connected") requestAlarms();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  // edgeデバイスの生存確認: ブローカーに接続している間、statusコマンドを定期送信し、
  // statusトピックへの応答がタイムアウト内に来なければオフライン扱いにする。
  // ブローカー未接続時は判定できないので unknown に戻す(オフラインと混同しない)。
  useEffect(() => {
    if (status !== "connected") {
      // ブローカー切断に同期してedge生存状態をリセットする
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setEdgeStatus("unknown");
      lastEdgeResponseAtRef.current = null;
      return;
    }

    // 接続直後を基準時刻とし、これより後に一度も応答が無ければオフライン判定する
    lastEdgeResponseAtRef.current = Date.now();
    publishCommand(buildStatusCommand());

    const pollId = setInterval(() => {
      publishCommand(buildStatusCommand());
      const last = lastEdgeResponseAtRef.current;
      if (last != null && Date.now() - last > STATUS_OFFLINE_THRESHOLD_MS) {
        setEdgeStatus("offline");
      }
    }, STATUS_POLL_INTERVAL_MS);

    return () => clearInterval(pollId);
  }, [status, publishCommand]);

  const envSeeded = isDev && Object.keys(envSettings()).length > 0;

  const value: MqttContextValue = {
    settings,
    updateSetting,
    status,
    edgeStatus,
    connect,
    disconnect,
    log,
    sendPowerCommand,
    alarms,
    alarmsUpdatedAt,
    requestAlarms,
    addAlarm,
    deleteAlarm,
    sendPauseCommand,
    sendStopCommand,
    envSeeded,
  };

  return <MqttContext.Provider value={value}>{children}</MqttContext.Provider>;
}
