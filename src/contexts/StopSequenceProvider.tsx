"use client";

import { createContext, useCallback, useContext, useState } from "react";

type StopSequenceContextValue = {
  armed: boolean;
  arm: () => void;
  disarm: () => void;
  lastStoppedAt: number | null;
  markStopped: () => void;
};

const StopSequenceContext = createContext<StopSequenceContextValue | null>(null);

/** StopSequenceProvider配下でのみ使用可能。「アラームを止める」フローの有効/無効を共有する */
export function useStopSequence(): StopSequenceContextValue {
  const ctx = useContext(StopSequenceContext);
  if (!ctx) throw new Error("useStopSequence must be used within StopSequenceProvider");
  return ctx;
}

/**
 * 「アラームを止める」フローのon/offを管理する。
 * armed中は WalkPauseBridge が歩行検知でpauseを、ArrivalStopBridge が位置情報到達でstopを送信する。
 * 意図せず実機へコマンドが送られ続けないよう、既定は無効・ページ再読み込みでは永続化しない。
 */
export default function StopSequenceProvider({ children }: { children: React.ReactNode }) {
  const [armed, setArmed] = useState(false);
  const [lastStoppedAt, setLastStoppedAt] = useState<number | null>(null);

  const arm = useCallback(() => setArmed(true), []);
  const disarm = useCallback(() => setArmed(false), []);
  const markStopped = useCallback(() => {
    setLastStoppedAt(Date.now());
    setArmed(false);
  }, []);

  const value: StopSequenceContextValue = { armed, arm, disarm, lastStoppedAt, markStopped };

  return <StopSequenceContext.Provider value={value}>{children}</StopSequenceContext.Provider>;
}
