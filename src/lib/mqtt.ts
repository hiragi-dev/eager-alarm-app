export type MqttSettings = {
  brokerUrl: string;
  username: string;
  password: string;
  deviceId: string;
};

export const STORAGE_KEY = "mqtt-demo-settings";

/** 名前空間プレフィックス（ブローカー上でのトピック衝突を減らすため） */
export const TOPIC_PREFIX = "eager-alarm";

/** 開発ビルドかどうか（process.env.NODE_ENV はビルド時に定数へ置換される） */
export const isDev = process.env.NODE_ENV !== "production";

/**
 * 既定値。認証情報や個人ブローカーのURLはコードに埋め込まない。
 * - 開発(テスト): env（下記 envSettings）＋アプリUIから設定
 * - 本番: アプリUIのみから設定
 */
export const defaultSettings: MqttSettings = {
  brokerUrl: "",
  username: "",
  password: "",
  deviceId: "",
};

/**
 * 開発時のみ環境変数から接続情報を読み込む。
 * 本番ビルドでは NODE_ENV 判定により以下の分岐が丸ごと除去され、
 * NEXT_PUBLIC_MQTT_* の値がクライアントバンドルへ埋め込まれない。
 */
export function envSettings(): Partial<MqttSettings> {
  if (process.env.NODE_ENV === "production") {
    return {};
  }
  const env: Partial<MqttSettings> = {};
  if (process.env.NEXT_PUBLIC_MQTT_BROKER_URL)
    env.brokerUrl = process.env.NEXT_PUBLIC_MQTT_BROKER_URL;
  if (process.env.NEXT_PUBLIC_MQTT_USERNAME)
    env.username = process.env.NEXT_PUBLIC_MQTT_USERNAME;
  if (process.env.NEXT_PUBLIC_MQTT_PASSWORD)
    env.password = process.env.NEXT_PUBLIC_MQTT_PASSWORD;
  if (process.env.NEXT_PUBLIC_MQTT_DEVICE_ID)
    env.deviceId = process.env.NEXT_PUBLIC_MQTT_DEVICE_ID;
  return env;
}

function pick(...vals: (string | undefined)[]): string {
  for (const v of vals) {
    if (v != null && v !== "") return v;
  }
  return "";
}

/**
 * 初期表示に使う設定を決定する。優先順位は
 * アプリUI（localStorage） > env（開発時のみ） > 既定値。
 * deviceId が無ければ一意な値を生成する。
 */
export function resolveInitialSettings(
  saved: Partial<MqttSettings> | null,
  env: Partial<MqttSettings>,
): MqttSettings {
  return {
    brokerUrl: pick(saved?.brokerUrl, env.brokerUrl, defaultSettings.brokerUrl),
    username: pick(saved?.username, env.username, defaultSettings.username),
    password: pick(saved?.password, env.password, defaultSettings.password),
    deviceId:
      pick(saved?.deviceId, env.deviceId, defaultSettings.deviceId) ||
      generateDeviceId(),
  };
}

export function commandTopic(deviceId: string): string {
  return `${TOPIC_PREFIX}/${deviceId}/command`;
}

export function statusTopic(deviceId: string): string {
  return `${TOPIC_PREFIX}/${deviceId}/status`;
}

/** eager-alarm-edge がアラーム一覧を返信するトピック */
export function alarmsTopic(deviceId: string): string {
  return `${TOPIC_PREFIX}/${deviceId}/alarms`;
}

/** ランダムなデバイスIDを生成（QRペアリングを見据えた一意ID） */
export function generateDeviceId(): string {
  const rand = Math.random().toString(16).slice(2, 10);
  return `demo-${rand}`;
}
