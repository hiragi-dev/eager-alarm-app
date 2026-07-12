import type { EdgeDeviceStatus, MqttStatus } from "@/contexts/MqttProvider";

/**
 * このモジュールは、MQTTブローカーへの接続状況・edgeデバイスの生存状況から
 * 「今アラーム関連の操作(追加/削除/停止方法の割り当て/手動停止)を行ってよいか」を
 * 一意に導出するための代数的データ型(discriminated union)と導出関数の集まり。
 *
 * ブローカー接続とedgeデバイスの生存は別物として扱う: ブローカーに接続できていても
 * edgeデバイス(Pi)自体が電源offやフリーズで応答しないことがあるため。
 *
 * 歩行検知・位置情報の「使えるかどうか」は各Provider(WalkSensorProvider/LocationProvider)が
 * 権限状態としてそれぞれ持っており、停止方法(位置情報)はアラームごとに
 * StopMethodProviderへの参照(stop_method_id)で紐付くため、ここでは扱わない。
 */

/** MQTTブローカーへの接続状態 */
export type BrokerConnection =
  | { kind: "disconnected" }
  | { kind: "connecting" }
  | { kind: "connected" }
  | { kind: "error" };

export function brokerConnectionFromStatus(status: MqttStatus): BrokerConnection {
  return { kind: status };
}

/** UIで表示するブロック理由 */
export type BlockReason = { kind: "broker-not-connected" } | { kind: "edge-offline" };

export function blockReasonLabel(reason: BlockReason): string {
  switch (reason.kind) {
    case "broker-not-connected":
      return "MQTTブローカーに接続していません";
    case "edge-offline":
      return "edgeデバイスがオフラインです";
  }
}

/** アラーム関連の操作(追加/削除/停止方法の割り当て/手動停止)が行えるかどうか */
export type AlarmManagementReadiness =
  | { kind: "ready" }
  | { kind: "blocked"; reasons: BlockReason[] };

export function deriveAlarmManagementReadiness(
  broker: BrokerConnection,
  edge: EdgeDeviceStatus,
): AlarmManagementReadiness {
  const reasons: BlockReason[] = [];
  if (broker.kind !== "connected") {
    reasons.push({ kind: "broker-not-connected" });
  } else if (edge !== "online") {
    reasons.push({ kind: "edge-offline" });
  }
  return reasons.length > 0 ? { kind: "blocked", reasons } : { kind: "ready" };
}
