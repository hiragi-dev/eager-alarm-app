import type { EdgeDeviceStatus, MqttStatus } from "@/contexts/MqttProvider";
import type { GyroPermission } from "@/hooks/useGyroscope";
import type { GeoTarget } from "@/lib/geo";
import type { LocationPermission } from "@/contexts/LocationProvider";

/**
 * このモジュールは、MQTTブローカーへの接続状況・edgeデバイスの生存状況・
 * 位置情報の許可状況・アラーム停止方法の有無から「今どの機能が使えるか」を一意に導出するための
 * 代数的データ型(discriminated union)と導出関数の集まり。各Providerが持つ生の状態
 * (MqttStatus, EdgeDeviceStatus, GyroPermission, LocationPermission等)をここでのみ組み合わせ、
 * コンポーネント側は導出結果を見て表示を出し分ける・操作を許可/禁止する。
 *
 * ブローカー接続とedgeデバイスの生存は別物として扱う: ブローカーに接続できていても
 * edgeデバイス(Pi)自体が電源offやフリーズで応答しないことがあるため。
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

/** 歩行検知(ジャイロ/加速度センサー)が使える状態かどうか */
export type WalkDetectionReadiness =
  | { kind: "unsupported" }
  | { kind: "insecure" }
  | { kind: "unauthorized" }
  | { kind: "ready" };

export function deriveWalkDetectionReadiness(
  supported: boolean | null,
  secureContext: boolean | null,
  permission: GyroPermission,
): WalkDetectionReadiness {
  if (supported === false) return { kind: "unsupported" };
  if (secureContext === false) return { kind: "insecure" };
  if (permission === "granted" || permission === "unnecessary") return { kind: "ready" };
  return { kind: "unauthorized" };
}

/** 位置情報による到達検知が使える状態かどうか */
export type LocationDetectionReadiness =
  | { kind: "unsupported" }
  | { kind: "insecure" }
  | { kind: "unauthorized" }
  | { kind: "no-target" }
  | { kind: "ready"; target: GeoTarget };

export function deriveLocationDetectionReadiness(
  permission: LocationPermission,
  target: GeoTarget | null,
): LocationDetectionReadiness {
  if (permission === "unsupported") return { kind: "unsupported" };
  if (permission === "insecure") return { kind: "insecure" };
  if (permission !== "granted") return { kind: "unauthorized" };
  if (!target) return { kind: "no-target" };
  return { kind: "ready", target };
}

/** 「アラームを止める」ために現在使える手段の組み合わせ */
export type StopMethod =
  | { kind: "none" }
  | { kind: "walk-only" }
  | { kind: "location-only"; target: GeoTarget }
  | { kind: "walk-and-location"; target: GeoTarget };

export function deriveStopMethod(
  walk: WalkDetectionReadiness,
  location: LocationDetectionReadiness,
): StopMethod {
  const hasWalk = walk.kind === "ready";
  const hasLocation = location.kind === "ready";
  if (hasWalk && hasLocation) return { kind: "walk-and-location", target: location.target };
  if (hasLocation) return { kind: "location-only", target: location.target };
  if (hasWalk) return { kind: "walk-only" };
  return { kind: "none" };
}

/** UIで表示するブロック理由 */
export type BlockReason =
  | { kind: "broker-not-connected" }
  | { kind: "edge-offline" }
  | { kind: "no-stop-method" };

export function blockReasonLabel(reason: BlockReason): string {
  switch (reason.kind) {
    case "broker-not-connected":
      return "MQTTブローカーに接続していません";
    case "edge-offline":
      return "edgeデバイスがオフラインです";
    case "no-stop-method":
      return "アラームを止める方法（歩行検知または位置情報）が使える状態になっていません";
  }
}

/** ブローカー接続とedgeデバイスの生存の両方から、操作を許可してよいかを判定する共通ロジック */
function deriveDeviceReasons(broker: BrokerConnection, edge: EdgeDeviceStatus): BlockReason[] {
  const reasons: BlockReason[] = [];
  if (broker.kind !== "connected") {
    reasons.push({ kind: "broker-not-connected" });
  } else if (edge !== "online") {
    reasons.push({ kind: "edge-offline" });
  }
  return reasons;
}

/** 「アラームを止める」フローを開始できるかどうか */
export type StopFlowReadiness =
  | { kind: "ready"; method: StopMethod }
  | { kind: "blocked"; reasons: BlockReason[] };

export function deriveStopFlowReadiness(
  broker: BrokerConnection,
  edge: EdgeDeviceStatus,
  method: StopMethod,
): StopFlowReadiness {
  const reasons = deriveDeviceReasons(broker, edge);
  if (method.kind === "none") reasons.push({ kind: "no-stop-method" });
  return reasons.length > 0 ? { kind: "blocked", reasons } : { kind: "ready", method };
}

/** アラーム管理(追加/削除/一覧)が使えるかどうか */
export type AlarmManagementReadiness =
  | { kind: "ready" }
  | { kind: "blocked"; reasons: BlockReason[] };

export function deriveAlarmManagementReadiness(
  broker: BrokerConnection,
  edge: EdgeDeviceStatus,
): AlarmManagementReadiness {
  const reasons = deriveDeviceReasons(broker, edge);
  return reasons.length > 0 ? { kind: "blocked", reasons } : { kind: "ready" };
}
