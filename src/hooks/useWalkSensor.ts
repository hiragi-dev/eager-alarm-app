"use client";

import { useCallback, useEffect, useState } from "react";

export type MotionData = {
  accelerationX: number | null;
  accelerationY: number | null;
  accelerationZ: number | null;
  accelerationGravityX: number | null;
  accelerationGravityY: number | null;
  accelerationGravityZ: number | null;
  interval: number | null;
};

/**
 * unnecessary: 明示的な許可リクエストが不要（Android Chrome等）
 * prompt: iOS Safari 等、ユーザー操作起点での許可リクエストが必要
 */
export type WalkSensorPermission = "unnecessary" | "prompt" | "granted" | "denied";

type EnvInfo = { supported: boolean; secureContext: boolean };

type RequestPermissionFn = () => Promise<"granted" | "denied">;

/** iOS Safari の DeviceMotionEvent.requestPermission は標準DOM型に無いため安全に取り出す */
function requestPermissionFnOf(ctor: unknown): RequestPermissionFn | undefined {
  const fn = (ctor as { requestPermission?: unknown } | undefined)?.requestPermission;
  return typeof fn === "function" ? (fn as RequestPermissionFn) : undefined;
}

/** スマホの加速度センサーを用いて歩行検知するためのフック */
export function useWalkSensor() {
  const [env, setEnv] = useState<EnvInfo | null>(null);
  const [permission, setPermission] = useState<WalkSensorPermission>("unnecessary");
  const [motion, setMotion] = useState<MotionData | null>(null);
  const [lastEventAt, setLastEventAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 初回マウント時に対応状況・許可要否を判定
  useEffect(() => {
    const hasMotion = typeof window !== "undefined" && "DeviceMotionEvent" in window;
    const needsPermission =
      hasMotion && !!requestPermissionFnOf(window.DeviceMotionEvent);
    setEnv({ supported: hasMotion, secureContext: window.isSecureContext });
    setPermission(needsPermission ? "prompt" : "unnecessary");
  }, []);

  // 許可済み（または不要）になったらイベント購読を開始する
  useEffect(() => {
    if (permission !== "granted" && permission !== "unnecessary") return;

    const onMotion = (e: DeviceMotionEvent) => {
      setMotion({
        accelerationX: e.acceleration?.x ?? null,
        accelerationY: e.acceleration?.y ?? null,
        accelerationZ: e.acceleration?.z ?? null,
        accelerationGravityX: e.accelerationIncludingGravity?.x ?? null,
        accelerationGravityY: e.accelerationIncludingGravity?.y ?? null,
        accelerationGravityZ: e.accelerationIncludingGravity?.z ?? null,
        interval: e.interval ?? null,
      });
      setLastEventAt(Date.now());
    };

    window.addEventListener("devicemotion", onMotion);
    return () => {
      window.removeEventListener("devicemotion", onMotion);
    };
  }, [permission]);

  const requestPermission = useCallback(async () => {
    setError(null);
    try {
      const motionRequest = requestPermissionFnOf(window.DeviceMotionEvent);

      if (!motionRequest) {
        setPermission("granted");
        return;
      }
      const result = await motionRequest();
      setPermission(result === "granted" ? "granted" : "denied");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setPermission("denied");
    }
  }, []);

  return {
    supported: env?.supported ?? null,
    secureContext: env?.secureContext ?? null,
    permission,
    requestPermission,
    motion,
    lastEventAt,
    error,
  };
}
