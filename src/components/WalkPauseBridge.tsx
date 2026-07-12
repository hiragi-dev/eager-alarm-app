"use client";

import { useEffect } from "react";
import { useWalkSensorContext } from "@/contexts/WalkSensorProvider";
import { useMqtt } from "@/contexts/MqttProvider";

/** 1回のpauseコマンドで停止させる時間 */
const PAUSE_DURATION_MS = 5000;
/** 歩行が続く間、停止期間が切れる前に再送する間隔 */
const RESEND_INTERVAL_MS = 2000;

/**
 * 歩行検知(WalkSensorProvider)とMQTT送信(MqttProvider)を橋渡しするUIなしコンポーネント。
 * アラームが鳴動中・歩行検知中・MQTT接続中の条件がすべて揃っている間、
 * pauseコマンドを一定間隔で再送してPi側の停止状態を延長し続ける。
 * アラームごとの個別設定を待たず、鳴動中は常時この一時停止(歩行検知)が働く
 * (停止方法(位置情報)とは独立した、鳴動中いつでも使える一時停止機能)。
 * どのタブを表示していても動作するよう、page.tsxの最上位で常時マウントしておく。
 */
export default function WalkPauseBridge() {
  const { isWalking } = useWalkSensorContext();
  const { status, ringingStatus, sendPauseCommand } = useMqtt();
  const isRinging = ringingStatus?.is_ringing === true;

  useEffect(() => {
    if (!isRinging || !isWalking || status !== "connected") return;

    sendPauseCommand(PAUSE_DURATION_MS);
    const id = setInterval(() => sendPauseCommand(PAUSE_DURATION_MS), RESEND_INTERVAL_MS);
    return () => clearInterval(id);
  }, [isRinging, isWalking, status, sendPauseCommand]);

  return null;
}
