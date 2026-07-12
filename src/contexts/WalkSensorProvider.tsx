"use client";

import { createContext, useContext, useEffect, useState } from "react";
import {
  useWalkSensor,
  type WalkSensorPermission,
  type MotionData,
} from "@/hooks/useWalkSensor";
import { useWalkingDetector } from "@/hooks/useWalkingDetector";
import { useNotify } from "@/contexts/NotificationProvider";

type WalkSensorContextValue = {
  supported: boolean | null;
  secureContext: boolean | null;
  permission: WalkSensorPermission;
  requestPermission: () => Promise<void>;
  motion: MotionData | null;
  lastEventAt: number | null;
  error: string | null;
  isWalking: boolean;
  stepCount: number;
};

const WalkSensorContext = createContext<WalkSensorContextValue | null>(null);

/** WalkSensorProvider配下でのみ使用可能。センサー状態・歩行検知結果を共有する */
export function useWalkSensorContext(): WalkSensorContextValue {
  const ctx = useContext(WalkSensorContext);
  if (!ctx) throw new Error("useWalkSensorContext must be used within WalkSensorProvider");
  return ctx;
}

/**
 * タブの表示/非表示に関わらずセンサーの検知を継続できるよう、
 * useWalkSensor/useWalkingDetector をページ全体で共有するためのProvider。
 */
export default function WalkSensorProvider({ children }: { children: React.ReactNode }) {
  const sensor = useWalkSensor();
  const { supported, secureContext, permission, requestPermission, error } = sensor;
  const { isWalking, stepCount } = useWalkingDetector(permission);
  const notify = useNotify();

  // 起動時の自動リクエスト(下のeffect)が一度完了するまでは、
  // まだ許可状況が確定していないだけなので警告ポップアップを出さない。
  // ブラウザが前回の許可を覚えている場合、この一瞬の「未許可」表示は不要なノイズになるため。
  const [startupRequestSettled, setStartupRequestSettled] = useState(false);

  useEffect(() => {
    if (error) notify("error", `センサーの利用許可でエラーが発生しました: ${error}`);
  }, [error, notify]);

  // アプリ起動時、許可がまだ得られていなければユーザー操作を待たずにまずリクエストしてみる。
  // ユーザー操作起点が不要な環境ではこれだけで許可ダイアログが出て完結する。
  // ユーザー操作起点が必須な環境(iOS Safari等)ではこの呼び出しは失敗するだけで
  // permission は prompt のまま維持されるため(useWalkSensor.ts参照)、
  // 直後のクリックリスナーが最初の操作で改めてリクエストする。
  useEffect(() => {
    if (permission !== "prompt") return;
    let cancelled = false;
    requestPermission().finally(() => {
      if (!cancelled) setStartupRequestSettled(true);
    });
    return () => {
      cancelled = true;
    };
  }, [permission, requestPermission]);

  // 許可がまだ得られていない(prompt)間は、アプリ内でのユーザー操作のたびに
  // 許可リクエストを送り続ける。iOS Safari等はユーザー操作起点でしか許可ダイアログを
  // 出せないため、設定画面のボタンを探してもらう代わりにこれで「常に要求する」を実現する。
  // permission が granted/denied に確定したらこの effect は再実行されてリスナーが外れるので、
  // 許可されるまでは毎回のクリックで再試行し、確定後は何もしなくなる。
  useEffect(() => {
    if (permission !== "prompt") return;
    const handleInteraction = () => {
      requestPermission();
    };
    document.addEventListener("click", handleInteraction);
    return () => document.removeEventListener("click", handleInteraction);
  }, [permission, requestPermission]);

  // センサーの利用が許可されていない間は、歩行検知によるアラーム自動一時停止が
  // 使えないことを一度だけ警告する(端末が非対応/非セキュアな場合は別の問題なので対象外)。
  // 起動時の自動リクエストが完了する前(まだ prompt が確定前)には出さない。
  useEffect(() => {
    if (supported === false || secureContext === false) return;
    if (!startupRequestSettled) return;
    if (permission === "prompt" || permission === "denied") {
      notify(
        "warning",
        "歩行検知センサーの利用が許可されていないため、歩行検知によるアラームの自動一時停止は使えません。",
      );
    }
  }, [permission, supported, secureContext, startupRequestSettled, notify]);

  const value: WalkSensorContextValue = {
    ...sensor,
    isWalking,
    stepCount,
  };

  return <WalkSensorContext.Provider value={value}>{children}</WalkSensorContext.Provider>;
}
