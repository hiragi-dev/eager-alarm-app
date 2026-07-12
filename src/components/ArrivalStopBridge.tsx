"use client";

import { useEffect, useRef } from "react";
import { useLocation } from "@/contexts/LocationProvider";
import { useMqtt } from "@/contexts/MqttProvider";
import { useStopMethods } from "@/contexts/StopMethodProvider";
import { distanceMeters } from "@/lib/geo";

/**
 * 位置情報(LocationProvider)・停止方法(StopMethodProvider)・MQTT送信(MqttProvider)を
 * 橋渡しするUIなしコンポーネント。鳴動中のアラームそれぞれについて、
 * そのアラームに割り当てられた停止方法(位置情報ベース)の地点を解決し、
 * 到達したらstopコマンドを一度だけ送信する。
 * アラームごとに事前に停止方法が紐づいているため、手動で「有効化」する操作は不要で、
 * 鳴動中は自動的に監視される。
 * どのタブを表示していても動作するよう、page.tsxの最上位で常時マウントしておく。
 */
export default function ArrivalStopBridge() {
  const { currentPosition, permission, startWatching } = useLocation();
  const { status, alarms, ringingStatus, sendStopCommand } = useMqtt();
  const { stopMethods } = useStopMethods();
  const firedForIdsRef = useRef<Set<string>>(new Set());

  const ringingIds = ringingStatus?.ringing_ids ?? [];
  const ringingIdsKey = ringingIds.join(",");

  // 鳴動中は自動的に現在地監視を開始する(位置情報ベースの停止方法を使うアラームのため)
  useEffect(() => {
    if (ringingIds.length === 0) return;
    if (permission === "unsupported" || permission === "insecure" || permission === "denied") return;
    startWatching();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ringingIdsKey, permission, startWatching]);

  useEffect(() => {
    if (status !== "connected" || ringingIds.length === 0 || !currentPosition) return;

    for (const alarmId of ringingIds) {
      if (firedForIdsRef.current.has(alarmId)) continue;
      const alarm = alarms.find((a) => a.id === alarmId);
      const method = alarm?.stop_method_id
        ? stopMethods.find((m) => m.id === alarm.stop_method_id)
        : undefined;
      if (!method) continue;

      const distance = distanceMeters(currentPosition, method);
      if (distance <= method.radiusMeters) {
        firedForIdsRef.current.add(alarmId);
        sendStopCommand();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, ringingIdsKey, currentPosition, alarms, stopMethods, sendStopCommand]);

  // 鳴動が止まったアラームIDは発火済み記録から外し、次回同じアラームが鳴った時に
  // 再度到達判定できるようにする
  useEffect(() => {
    const stillRinging = new Set(ringingIds);
    for (const id of firedForIdsRef.current) {
      if (!stillRinging.has(id)) firedForIdsRef.current.delete(id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ringingIdsKey]);

  return null;
}
