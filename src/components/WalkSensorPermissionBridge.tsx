"use client";

import { useEffect } from "react";
import { useMqtt } from "@/contexts/MqttProvider";
import { useWalkSensorContext } from "@/contexts/WalkSensorProvider";

/**
 * 鳴動中に限り、最初のユーザー操作でモーションセンサーの利用許可を要求するUIなしコンポーネント。
 *
 * iOS Safari はユーザー操作の中でしか requestPermission() を受け付けず、しかも許可を
 * 起動をまたいで保持しない(ホーム画面Webアプリでは毎回ダイアログが出る)。
 * アプリ側で許可状態を保存しても、リクエストを通さない限り devicemotion は流れてこない。
 *
 * 歩行検知が要るのは鳴動中だけ(WalkPauseBridge参照)なので、起動直後の無関係なタップを
 * 奪うのはやめ、鳴っている間のタップ - 停止しようとして画面を操作する、まさにその瞬間 - に
 * OSの許可ダイアログを出す。停止タブへの遷移でも下部ナビの操作でも拾えるよう、
 * 特定のボタンではなく document のクリックを見る。
 * 許可/拒否が確定すればこのeffectは再実行されてリスナーが外れる。
 */
export default function WalkSensorPermissionBridge() {
  const { permission, requestPermission } = useWalkSensorContext();
  const { ringingStatus } = useMqtt();
  const isRinging = ringingStatus?.is_ringing === true;

  useEffect(() => {
    if (!isRinging || permission !== "prompt") return;
    const handleInteraction = () => {
      requestPermission();
    };
    document.addEventListener("click", handleInteraction);
    return () => document.removeEventListener("click", handleInteraction);
  }, [isRinging, permission, requestPermission]);

  return null;
}
