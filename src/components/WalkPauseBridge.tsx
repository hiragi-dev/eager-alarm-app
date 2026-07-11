"use client";

import { useEffect } from "react";
import { useWalkSensorContext } from "@/contexts/WalkSensorProvider";
import { useMqtt } from "@/contexts/MqttProvider";
import { useStopSequence } from "@/contexts/StopSequenceProvider";

/** 1回のpauseコマンドで停止させる時間 */
const PAUSE_DURATION_MS = 5000;
/** 歩行が続く間、停止期間が切れる前に再送する間隔 */
const RESEND_INTERVAL_MS = 2000;

/**
 * 歩行検知(WalkSensorProvider)とMQTT送信(MqttProvider)を橋渡しするUIなしコンポーネント。
 * 「アラームを止める」フローが有効(armed)・歩行検知中・MQTT接続中の条件がすべて揃っている間のみ、
 * pauseコマンドを一定間隔で再送してPi側の停止状態を延長し続ける。
 * どのタブを表示していても動作するよう、page.tsxの最上位で常時マウントしておく。
 */
export default function WalkPauseBridge() {
  const { isWalking } = useWalkSensorContext();
  const { armed } = useStopSequence();
  const { status, sendPauseCommand } = useMqtt();

  useEffect(() => {
    if (!armed || !isWalking || status !== "connected") return;

    sendPauseCommand(PAUSE_DURATION_MS);
    const id = setInterval(() => sendPauseCommand(PAUSE_DURATION_MS), RESEND_INTERVAL_MS);
    return () => clearInterval(id);
  }, [armed, isWalking, status, sendPauseCommand]);

  return null;
}
