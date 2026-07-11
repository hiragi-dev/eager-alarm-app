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
 */
export default function WalkSensorProvider({ children }: { children: React.ReactNode }) {
  const sensor = useWalkSensor();
  const { isWalking, stepCount } = useWalkingDetector(sensor.permission);
  const notify = useNotify();

  useEffect(() => {
    if (sensor.error) notify("error", `センサーの利用許可でエラーが発生しました: ${sensor.error}`);
  }, [sensor.error, notify]);

  const value: WalkSensorContextValue = {
    ...sensor,
    isWalking,
    stepCount,
  };

  return <WalkSensorContext.Provider value={value}>{children}</WalkSensorContext.Provider>;
}
