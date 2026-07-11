"use client";

import { useGyro } from "@/contexts/GyroProvider";
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
 * MqttProvider/GyroProvider/LocationProvider の生の状態を合成し、
 * 「今どの機能が使えるか」をsrc/lib/appState.tsの代数的データ型として導出する。
 * MqttProvider・GyroProvider・LocationProvider の配下でのみ使用可能。
 */
export function useAppReadiness(): AppReadiness {
  const { status, edgeStatus } = useMqtt();
  const { supported: gyroSupported, secureContext: gyroSecureContext, permission: gyroPermission } =
    useGyro();
  const { permission: locationPermission, target } = useLocation();

  const broker = brokerConnectionFromStatus(status);
  const walk = deriveWalkDetectionReadiness(gyroSupported, gyroSecureContext, gyroPermission);
  const location = deriveLocationDetectionReadiness(locationPermission, target);
  const stopMethod = deriveStopMethod(walk, location);
  const stopFlow = deriveStopFlowReadiness(broker, edgeStatus, stopMethod);
  const alarmManagement = deriveAlarmManagementReadiness(broker, edgeStatus);

  return { broker, edge: edgeStatus, walk, location, stopMethod, stopFlow, alarmManagement };
}
