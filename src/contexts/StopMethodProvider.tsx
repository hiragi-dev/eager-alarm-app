"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { STOP_METHOD_STORAGE_KEY, type StopMethod } from "@/lib/stopMethod";

type NewStopMethodInput = {
  label: string;
  lat: number;
  lng: number;
  radiusMeters: number;
};

type StopMethodContextValue = {
  stopMethods: StopMethod[];
  addStopMethod: (input: NewStopMethodInput) => StopMethod;
  deleteStopMethod: (id: string) => void;
};

const StopMethodContext = createContext<StopMethodContextValue | null>(null);

/** StopMethodProvider配下でのみ使用可能。登録済みの停止方法(位置情報ベース)一覧を共有する */
export function useStopMethods(): StopMethodContextValue {
  const ctx = useContext(StopMethodContext);
  if (!ctx) throw new Error("useStopMethods must be used within StopMethodProvider");
  return ctx;
}

/**
 * アラームの「止め方」として登録された停止方法(現状は位置情報ベースのみ)を
 * localStorageで永続化して管理する。edgeデバイスとは無関係のブラウザ内データ。
 */
export default function StopMethodProvider({ children }: { children: React.ReactNode }) {
  const [stopMethods, setStopMethods] = useState<StopMethod[]>([]);

  // 初回マウント時にlocalStorageから復元
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STOP_METHOD_STORAGE_KEY);
      if (raw) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setStopMethods(JSON.parse(raw));
      }
    } catch {
      // ignore storage errors
    }
  }, []);

  const persist = useCallback((next: StopMethod[]) => {
    setStopMethods(next);
    try {
      localStorage.setItem(STOP_METHOD_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignore storage errors
    }
  }, []);

  const addStopMethod = useCallback(
    (input: NewStopMethodInput): StopMethod => {
      const method: StopMethod = {
        id: crypto.randomUUID(),
        label: input.label,
        lat: input.lat,
        lng: input.lng,
        radiusMeters: input.radiusMeters,
        createdAt: Date.now(),
      };
      persist([...stopMethods, method]);
      return method;
    },
    [stopMethods, persist],
  );

  const deleteStopMethod = useCallback(
    (id: string) => {
      persist(stopMethods.filter((m) => m.id !== id));
    },
    [stopMethods, persist],
  );

  const value: StopMethodContextValue = { stopMethods, addStopMethod, deleteStopMethod };

  return <StopMethodContext.Provider value={value}>{children}</StopMethodContext.Provider>;
}
