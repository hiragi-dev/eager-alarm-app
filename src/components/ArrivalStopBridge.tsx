"use client";

import { useEffect, useRef } from "react";
import { useLocation } from "@/contexts/LocationProvider";
import { useMqtt } from "@/contexts/MqttProvider";
import { useStopSequence } from "@/contexts/StopSequenceProvider";

/**
 * 位置情報(LocationProvider)とMQTT送信(MqttProvider)を橋渡しするUIなしコンポーネント。
 * 「アラームを止める」フローが有効(armed)な間に登録済みの停止地点へ到達したら、
 * stopコマンドを一度だけ送信し、自動的にフローを解除する。
 * どのタブを表示していても動作するよう、page.tsxの最上位で常時マウントしておく。
 */
export default function ArrivalStopBridge() {
  const { armed, markStopped } = useStopSequence();
  const { hasArrived } = useLocation();
  const { status, sendStopCommand } = useMqtt();
  const firedRef = useRef(false);

  useEffect(() => {
    if (!armed) {
      firedRef.current = false;
      return;
    }
    if (!hasArrived) {
      firedRef.current = false;
      return;
    }
    if (firedRef.current || status !== "connected") return;

    firedRef.current = true;
    sendStopCommand();
    markStopped();
  }, [armed, hasArrived, status, sendStopCommand, markStopped]);

  return null;
}
