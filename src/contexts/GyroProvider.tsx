"use client";

import { createContext, useContext, useEffect } from "react";
import {
  useGyroscope,
  type GyroPermission,
  type MotionData,
  type OrientationData,
} from "@/hooks/useGyroscope";
import { useWalkingDetector } from "@/hooks/useWalkingDetector";
import { useNotify } from "@/contexts/NotificationProvider";

type GyroContextValue = {
  supported: boolean | null;
  secureContext: boolean | null;
  permission: GyroPermission;
  requestPermission: () => Promise<void>;
  orientation: OrientationData | null;
  motion: MotionData | null;
  lastEventAt: number | null;
  error: string | null;
  isWalking: boolean;
  stepCount: number;
};

const GyroContext = createContext<GyroContextValue | null>(null);

/** GyroProvider配下でのみ使用可能。センサー状態・歩行検知結果を共有する */
export function useGyro(): GyroContextValue {
  const ctx = useContext(GyroContext);
  if (!ctx) throw new Error("useGyro must be used within GyroProvider");
  return ctx;
}

/**
 * タブの表示/非表示に関わらずセンサーの検知を継続できるよう、
 * useGyroscope/useWalkingDetector をページ全体で共有するためのProvider。
 */
export default function GyroProvider({ children }: { children: React.ReactNode }) {
  const gyro = useGyroscope();
  const { isWalking, stepCount } = useWalkingDetector(gyro.permission);
  const notify = useNotify();

  useEffect(() => {
    if (gyro.error) notify("error", `センサーの利用許可でエラーが発生しました: ${gyro.error}`);
  }, [gyro.error, notify]);

  const value: GyroContextValue = {
    ...gyro,
    isWalking,
    stepCount,
  };

  return <GyroContext.Provider value={value}>{children}</GyroContext.Provider>;
}
