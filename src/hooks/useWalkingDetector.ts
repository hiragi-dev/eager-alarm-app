"use client";

import { useEffect, useRef, useState } from "react";
import type { GyroPermission } from "@/hooks/useGyroscope";

const GRAVITY = 9.81;
/** 重力を除いた加速度の変動がこの値(m/s²)を超えたら「歩行によるピーク」候補とみなす */
const PEAK_THRESHOLD = 1.2;
/** ピーク間の最小間隔。これより短い間隔は同一ステップのノイズとみなして無視する */
const MIN_STEP_INTERVAL_MS = 250;
/** この時間内の歩数で歩行判定を行う */
const STEP_WINDOW_MS = 3000;
/** STEP_WINDOW_MS 内にこの歩数以上あれば「歩行中」と判定する */
const MIN_STEPS_IN_WINDOW = 3;
/** 最後の歩数からこの時間経過したら「歩行中」を解除する */
const WALKING_TIMEOUT_MS = 1500;

/**
 * devicemotion の加速度（重力込み）の変動から簡易的に歩行を検知するフック。
 * 加速度ベクトルの大きさが立ち上がり→下降に転じる「ピーク」を歩数としてカウントし、
 * 直近 STEP_WINDOW_MS 内に MIN_STEPS_IN_WINDOW 回以上ピークがあれば歩行中と判定する。
 * しきい値は簡易的なもので、端末の持ち方・機種によって精度は変わる。
 */
export function useWalkingDetector(permission: GyroPermission) {
  const [isWalking, setIsWalking] = useState(false);
  const [stepCount, setStepCount] = useState(0);

  const lastMagnitudeRef = useRef<number | null>(null);
  const risingRef = useRef(false);
  const lastStepAtRef = useRef(0);
  const stepTimestampsRef = useRef<number[]>([]);

  useEffect(() => {
    if (permission !== "granted" && permission !== "unnecessary") return;

    const onMotion = (e: DeviceMotionEvent) => {
      const g = e.accelerationIncludingGravity;
      if (!g || g.x == null || g.y == null || g.z == null) return;

      const magnitude = Math.sqrt(g.x * g.x + g.y * g.y + g.z * g.z) - GRAVITY;
      const now = Date.now();
      const last = lastMagnitudeRef.current;
      lastMagnitudeRef.current = magnitude;
      if (last == null) return;

      const wasRising = risingRef.current;
      const isRising = magnitude > last;
      risingRef.current = isRising;

      const isPeak = wasRising && !isRising && magnitude > PEAK_THRESHOLD;
      if (!isPeak || now - lastStepAtRef.current <= MIN_STEP_INTERVAL_MS) return;

      lastStepAtRef.current = now;
      const timestamps = stepTimestampsRef.current.filter((t) => now - t <= STEP_WINDOW_MS);
      timestamps.push(now);
      stepTimestampsRef.current = timestamps;

      setStepCount((c) => c + 1);
      setIsWalking(timestamps.length >= MIN_STEPS_IN_WINDOW);
    };

    window.addEventListener("devicemotion", onMotion);
    return () => window.removeEventListener("devicemotion", onMotion);
  }, [permission]);

  // 歩数が一定時間途絶えたら歩行中フラグを下ろす
  useEffect(() => {
    if (!isWalking) return;
    const id = setInterval(() => {
      if (Date.now() - lastStepAtRef.current > WALKING_TIMEOUT_MS) {
        setIsWalking(false);
      }
    }, 300);
    return () => clearInterval(id);
  }, [isWalking]);

  return { isWalking, stepCount };
}
