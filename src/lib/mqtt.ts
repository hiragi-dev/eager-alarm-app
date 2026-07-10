export type MqttSettings = {
  brokerUrl: string;
  username: string;
  password: string;
  deviceId: string;
};

export const STORAGE_KEY = "mqtt-demo-settings";

/** 名前空間プレフィックス（公開ブローカー上での衝突を減らすため） */
export const TOPIC_PREFIX = "alarm-demo";

export const defaultSettings: MqttSettings = {
  // アカウント不要で使えるHiveMQの公開テストブローカー（WebSocket/TLS）。
  // 本番では HiveMQ Cloud などの認証付きブローカーに差し替える。
  brokerUrl: "wss://broker.hivemq.com:8884/mqtt",
  username: "",
  password: "",
  deviceId: "",
};

export function commandTopic(deviceId: string): string {
  return `${TOPIC_PREFIX}/${deviceId}/command`;
}

export function statusTopic(deviceId: string): string {
  return `${TOPIC_PREFIX}/${deviceId}/status`;
}

/** ランダムなデバイスIDを生成（QRペアリングを見据えた一意ID） */
export function generateDeviceId(): string {
  const rand = Math.random().toString(16).slice(2, 10);
  return `demo-${rand}`;
}
