"use client";

import { useMqtt } from "@/contexts/MqttProvider";
import {
  brokerConnectionFromStatus,
  deriveAlarmManagementReadiness,
  type AlarmManagementReadiness,
  type BrokerConnection,
} from "@/lib/appState";

export type AppReadiness = {
  broker: BrokerConnection;
  alarmManagement: AlarmManagementReadiness;
};

/**
 * MqttProviderの生の状態から、「今アラーム関連の操作を行ってよいか」を
 * src/lib/appState.tsの代数的データ型として導出する。MqttProvider配下でのみ使用可能。
 */
export function useAppReadiness(): AppReadiness {
  const { status, edgeStatus } = useMqtt();

  const broker = brokerConnectionFromStatus(status);
  const alarmManagement = deriveAlarmManagementReadiness(broker, edgeStatus);

  return { broker, alarmManagement };
}
