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
  ringingStatusTopic,
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
  buildEditCommand,
  buildDeleteCommand,
  buildListCommand,
  buildPauseCommand,
  buildRingingStatusCommand,
  buildStatusCommand,
  buildStopCommand,
  sortAlarmsByTime,
  type Alarm,
  type DayOfWeek,
  type RingingStatus,
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
/** ringing_status的のポーリング間隔 */
const RINGING_POLL_INTERVAL_MS = 3000;

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
  addAlarm: (time: string, daysOfWeek: DayOfWeek[], isEnabled: boolean, stopMethodId: string, isNfcEnabled: boolean) => void;
  editAlarm: (
    id: string,
    time: string,
    daysOfWeek: DayOfWeek[],
    isEnabled: boolean,
    stopMethodId: string,
    isNfcEnabled: boolean,
  ) => void;
  deleteAlarm: (id: string) => void;
  sendPauseCommand: (durationMs: number) => void;
  /** 戻り値のPromiseはブローカーへの配信確認(QoS2完了)を表す。falseは送信失敗 */
  sendStopCommand: () => Promise<boolean>;
  ringingStatus: RingingStatus | null;
  envSeeded: boolean;
  // isNfcEnabled: boolean;
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
  const [ringingStatus, setRingingStatus] = useState<RingingStatus | null>(null);
  // const [isNfcEnabled, setIsNfcEnabled] = useState<boolean>(false);
  const clientRef = useRef<MqttClient | null>(null);
  const lastEdgeResponseAtRef = useRef<number | null>(null);
  const lastVisibilityReconnectAtRef = useRef(0);

  const addLog = useCallback((text: string) => {
    const time = new Date().toLocaleTimeString("ja-JP", { hour12: false });
    setLog((prev) => [{ time, text }, ...prev].slice(0, MAX_LOG));
  }, []);

  // 初回マウント時: アプリUI(localStorage) > env(開発時のみ) > 既定値 の優先順で初期値を決定。
  // 認証情報はユーザーが編集したときだけ保存し、env値はバンドル/localStorageに固定しない。
  // deviceId のみ安定化のために保存する。
  useEffect(() => {
    let saved: Partial<MqttSettings> | null = null;
    // 読み取りに失敗したかどうか。「保存が無い(初回起動)」と区別する必要がある
    let readFailed = false;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed: unknown = JSON.parse(raw);
        if (parsed !== null && typeof parsed === "object") {
          saved = parsed as Partial<MqttSettings>;
        } else {
          readFailed = true;
        }
      }
    } catch {
      saved = null;
      readFailed = true;
    }
    const merged = resolveInitialSettings(saved, envSettings());
    // 読めなかった値を deviceId だけの内容で上書きすると、ブローカーURLや認証情報を
    // こちらから消してしまう。読めたときにだけ書き戻す
    if (!readFailed) {
      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ ...(saved ?? {}), deviceId: merged.deviceId }),
        );
      } catch {
        // ignore storage errors
      }
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
      // 切断時にmqtt.js自身が自動再接続するようにする(0=無効だと、モバイルでの
      // バックグラウンド遷移などで切れた際に誰も再接続を試みなくなってしまう)
      reconnectPeriod: 4000,
    };

    const client = mqtt.connect(s.brokerUrl, options);
    clientRef.current = client;
    const sTopic = statusTopic(s.deviceId);
    const aTopic = alarmsTopic(s.deviceId);
    const rTopic = ringingStatusTopic(s.deviceId);

    client.on("connect", () => {
      setStatus("connected");
      addLog("接続しました");
      client.subscribe([sTopic, aTopic, rTopic], { qos: 2 }, (err) => {
        if (err) {
          addLog(`購読失敗: ${err.message}`);
          notify("error", `トピックの購読に失敗しました: ${err.message}`);
        } else {
          addLog(`購読開始: ${sTopic}, ${aTopic}, ${rTopic} (QoS 2)`);
        }
      });
    });

    client.on("reconnect", () => {
      // 古いクライアントの取り置きイベントは無視する(disconnect()やvisibility復帰時の
      // 強制再接続で既に別のクライアントに差し替わっている場合があるため)
      if (clientRef.current !== client) return;
      setStatus("connecting");
      addLog("再接続を試みています…");
    });

    client.on("message", (topic, payload) => {
      const text = payload.toString();
      addLog(`← ${topic}: ${text}`);
      if (topic === aTopic) {
        try {
          const rawAlarms = JSON.parse(text);
          // Sort by time as per v2 spec
          setAlarms(sortAlarmsByTime(rawAlarms as Alarm[]));
          setAlarmsUpdatedAt(Date.now());
        } catch {
          addLog("アラーム一覧の解析に失敗しました");
        }
      }
      if (topic === rTopic) {
        try {
          const rs = JSON.parse(text) as RingingStatus;
          setRingingStatus(rs);
        } catch {
          addLog("ringing_status の解析に失敗しました");
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
      if (clientRef.current !== client) return;
      setStatus("error");
      setEdgeStatus("unknown");
      addLog(`エラー: ${err.message}`);
      notify("error", `MQTT接続エラー: ${err.message}`);
    });

    client.on("close", () => {
      if (clientRef.current !== client) return;
      // reconnectPeriod > 0 なので、close は「再接続を試みる直前」にも都度発火する。
      // status を disconnected にしてしまうと、実際には裏で再接続中なのに
      // 「接続」ボタンが押せる(＝connect()が早期returnして何も起きない)ように見えてしまうため、
      // 明示的な切断(disconnect())以外はいったん connecting のままにしておく。
      setStatus((prev) => (prev === "error" ? prev : "connecting"));
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

  // アプリがバックグラウンドから復帰した際に接続を確認し、切れていれば再接続する。
  // モバイルではバックグラウンド中にOSがWebSocketやタイマーを止めることがあり、
  // mqtt.js自身の自動再接続(reconnectPeriod)だけでは復帰時にすぐ繋がらない場合があるため、
  // フォアグラウンド復帰を検知したら念のため既存クライアントを破棄して繋ぎ直す。
  // status は close のたびに connecting になり得るため判定に使わず、
  // クライアント自身の connected フラグ(実際に接続確立済みかどうか)で判定する。
  useEffect(() => {
    const handleVisible = () => {
      if (document.visibilityState !== "visible") return;
      if (clientRef.current?.connected) return;
      if (!settings.brokerUrl || !settings.deviceId) return;
      const now = Date.now();
      if (now - lastVisibilityReconnectAtRef.current < 3000) return;
      lastVisibilityReconnectAtRef.current = now;
      addLog("アプリがフォアグラウンドに復帰しました。接続を確認します…");
      clientRef.current?.end(true);
      clientRef.current = null;
      connect();
    };
    document.addEventListener("visibilitychange", handleVisible);
    return () => document.removeEventListener("visibilitychange", handleVisible);
  }, [settings.brokerUrl, settings.deviceId, connect, addLog]);

  /**
   * QoS 2(Exactly Once)でコマンドを送信する。戻り値のPromiseは、ブローカーへの配信が
   * QoS2ハンドシェイク(PUBCOMP)まで完了したかどうかを表す(true=配信確認済み)。
   * 停止コマンドのように「確実に送信できたか」をUI側で待ち受けたい呼び出し元のために用意している。
   */
  const publishCommand = useCallback(
    (payload: unknown): Promise<boolean> => {
      return new Promise((resolve) => {
        const client = clientRef.current;
        if (!client || status !== "connected") {
          resolve(false);
          return;
        }
        const topic = commandTopic(settings.deviceId);
        const text = JSON.stringify(payload);
        client.publish(topic, text, { qos: 2 }, (err) => {
          if (err) {
            addLog(`送信失敗: ${err.message}`);
            notify("error", `コマンドの送信に失敗しました: ${err.message}`);
            resolve(false);
          } else {
            addLog(`→ ${topic}: ${text}`);
            resolve(true);
          }
        });
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
    (time: string, daysOfWeek: DayOfWeek[], isEnabled: boolean, stopMethodId: string, isNfcEnabled: boolean) => {
      publishCommand(buildAddCommand(time, daysOfWeek, isEnabled, stopMethodId, isNfcEnabled));
      // add はエッジ側から一覧の自動返信が来ない前提のため、直後に list を送って更新する。
      publishCommand(buildListCommand());
    },
    [publishCommand],
  );

  const editAlarm = useCallback(
    (
      id: string,
      time: string,
      daysOfWeek: DayOfWeek[],
      isEnabled: boolean,
      stopMethodId: string,
      isNfcEnabled: boolean,
    ) => {
      publishCommand(buildEditCommand(id, time, daysOfWeek, isEnabled, stopMethodId, isNfcEnabled));
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
    return publishCommand(buildStopCommand());
  }, [publishCommand]);

  // 接続確立時に最新のアラーム一覧とringing_statusを自動取得する
  useEffect(() => {
    if (status === "connected") {
      requestAlarms();
      // publishCommand(buildRingingStatusCommand());
    }
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
    editAlarm,
    deleteAlarm,
    sendPauseCommand,
    sendStopCommand,
    ringingStatus,
    envSeeded,
    // isNfcEnabled,
  };

  return <MqttContext.Provider value={value}>{children}</MqttContext.Provider>;
}
