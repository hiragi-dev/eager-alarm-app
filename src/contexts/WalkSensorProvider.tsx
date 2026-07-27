"use client";

import { createContext, useContext, useEffect } from "react";
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
 *
 * 許可のリクエストはここでは行わない。iOS Safari はユーザー操作の中でしか
 * リクエストを受け付けず、しかも許可を起動をまたいで保持しないため、
 * 歩行検知が実際に要る場面(＝鳴動中)のタップで WalkSensorPermissionBridge が要求する。
 */
export default function WalkSensorProvider({ children }: { children: React.ReactNode }) {
  const sensor = useWalkSensor();
  const { permission, error } = sensor;
  const { isWalking, stepCount } = useWalkingDetector(permission);
  const notify = useNotify();

  // 許可リクエストはユーザー操作の中でしか走らないため、ここで拾うエラーは
  // 「操作起点で要求したのに失敗した」ケースだけになる。起動時に自動リクエストしていた頃は、
  // iOSで必ず失敗するユーザー操作起点エラーを毎起動そのまま通知してしまっていた。
  useEffect(() => {
    if (error) notify("error", `センサーの利用許可でエラーが発生しました: ${error}`);
  }, [error, notify]);

  const value: WalkSensorContextValue = {
    ...sensor,
    isWalking,
    stepCount,
  };

  return <WalkSensorContext.Provider value={value}>{children}</WalkSensorContext.Provider>;
}
