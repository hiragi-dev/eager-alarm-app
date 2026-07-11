"use client";

import { useCallback, useEffect, useState } from "react";

export type OrientationData = {
  alpha: number | null;
  beta: number | null;
  gamma: number | null;
  absolute: boolean;
};

export type MotionData = {
  rotationAlpha: number | null;
  rotationBeta: number | null;
  rotationGamma: number | null;
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
export type GyroPermission = "unnecessary" | "prompt" | "granted" | "denied";

type EnvInfo = { supported: boolean; secureContext: boolean };

type RequestPermissionFn = () => Promise<"granted" | "denied">;

/** iOS Safari の DeviceOrientationEvent/DeviceMotionEvent.requestPermission は標準DOM型に無いため安全に取り出す */
function requestPermissionFnOf(ctor: unknown): RequestPermissionFn | undefined {
  const fn = (ctor as { requestPermission?: unknown } | undefined)?.requestPermission;
  return typeof fn === "function" ? (fn as RequestPermissionFn) : undefined;
}

/** スマホのジャイロ（傾き・回転速度）を検知するためのフック */
export function useGyroscope() {
  const [env, setEnv] = useState<EnvInfo | null>(null);
  const [permission, setPermission] = useState<GyroPermission>("unnecessary");
  const [orientation, setOrientation] = useState<OrientationData | null>(null);
  const [motion, setMotion] = useState<MotionData | null>(null);
  const [lastEventAt, setLastEventAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 初回マウント時に対応状況・許可要否を判定
  useEffect(() => {
    const hasOrientation = typeof window !== "undefined" && "DeviceOrientationEvent" in window;
    const hasMotion = typeof window !== "undefined" && "DeviceMotionEvent" in window;
    const needsPermission =
      hasOrientation && !!requestPermissionFnOf(window.DeviceOrientationEvent);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEnv({ supported: hasOrientation || hasMotion, secureContext: window.isSecureContext });
    setPermission(needsPermission ? "prompt" : "unnecessary");
  }, []);

  // 許可済み（または不要）になったらイベント購読を開始する
  useEffect(() => {
    if (permission !== "granted" && permission !== "unnecessary") return;

    const onOrientation = (e: DeviceOrientationEvent) => {
      setOrientation({ alpha: e.alpha, beta: e.beta, gamma: e.gamma, absolute: e.absolute });
      setLastEventAt(Date.now());
    };
    const onMotion = (e: DeviceMotionEvent) => {
      setMotion({
        rotationAlpha: e.rotationRate?.alpha ?? null,
        rotationBeta: e.rotationRate?.beta ?? null,
        rotationGamma: e.rotationRate?.gamma ?? null,
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

    window.addEventListener("deviceorientation", onOrientation);
    window.addEventListener("devicemotion", onMotion);
    return () => {
      window.removeEventListener("deviceorientation", onOrientation);
      window.removeEventListener("devicemotion", onMotion);
    };
  }, [permission]);

  const requestPermission = useCallback(async () => {
    setError(null);
    try {
      const orientationRequest = requestPermissionFnOf(window.DeviceOrientationEvent);
      const motionRequest = requestPermissionFnOf(window.DeviceMotionEvent);

      if (!orientationRequest && !motionRequest) {
        setPermission("granted");
        return;
      }
      const results = await Promise.all([
        orientationRequest ? orientationRequest() : Promise.resolve<"granted">("granted"),
        motionRequest ? motionRequest() : Promise.resolve<"granted">("granted"),
      ]);
      setPermission(results.every((r) => r === "granted") ? "granted" : "denied");
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
    orientation,
    motion,
    lastEventAt,
    error,
  };
}
