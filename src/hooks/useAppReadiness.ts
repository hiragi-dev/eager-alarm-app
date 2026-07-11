"use client";

import { useWalkSensorContext } from "@/contexts/WalkSensorProvider";
import { useLocation } from "@/contexts/LocationProvider";
import { useMqtt, type EdgeDeviceStatus } from "@/contexts/MqttProvider";
import {
  brokerConnectionFromStatus,
  deriveAlarmManagementReadiness,
  deriveLocationDetectionReadiness,
  deriveStopFlowReadiness,
  deriveStopMethod,
  deriveWalkDetectionReadiness,
  type AlarmManagementReadiness,
  type BrokerConnection,
  type LocationDetectionReadiness,
  type StopFlowReadiness,
  type StopMethod,
  type WalkDetectionReadiness,
} from "@/lib/appState";

export type AppReadiness = {
  broker: BrokerConnection;
  edge: EdgeDeviceStatus;
  walk: WalkDetectionReadiness;
  location: LocationDetectionReadiness;
  stopMethod: StopMethod;
  stopFlow: StopFlowReadiness;
  alarmManagement: AlarmManagementReadiness;
};

/**
 * MqttProvider/WalkSensorProvider/LocationProvider の生の状態を合成し、
 * 「この機能は今使える状態か？」「どの方法で止める設定になっているか？」をページ全体に提供する。
 * MqttProvider・WalkSensorProvider・LocationProvider の配下でのみ使用可能。
 */
export function useAppReadiness(): AppReadiness {
  const { status, edgeStatus } = useMqtt();
  const { supported: walkSensorSupported, secureContext: walkSensorSecureContext, permission: walkSensorPermission } =
    useWalkSensorContext();
  const { permission: locationPermission, target } = useLocation();

  const broker = brokerConnectionFromStatus(status);
  const walk = deriveWalkDetectionReadiness(walkSensorSupported, walkSensorSecureContext, walkSensorPermission);
  const location = deriveLocationDetectionReadiness(locationPermission, target);
  const stopMethod = deriveStopMethod(walk, location);
  const stopFlow = deriveStopFlowReadiness(broker, edgeStatus, stopMethod);
  const alarmManagement = deriveAlarmManagementReadiness(broker, edgeStatus);

  return { broker, edge: edgeStatus, walk, location, stopMethod, stopFlow, alarmManagement };
}
