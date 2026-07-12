"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { GeoPoint } from "@/lib/geo";
import { useNotify } from "@/contexts/NotificationProvider";

type CurrentPosition = GeoPoint & { accuracy: number };

/**
 * unsupported: 端末/ブラウザが非対応
 * insecure: セキュアコンテキストでない(HTTPS/localhost以外)
 * prompt: まだ取得を開始していない(許可状況は未確定)
 * granted: 取得中(許可済み)
 * denied: ユーザーが拒否した
 */
export type LocationPermission = "unsupported" | "insecure" | "prompt" | "granted" | "denied";

type LocationContextValue = {
  permission: LocationPermission;
  watching: boolean;
  startWatching: () => void;
  currentPosition: CurrentPosition | null;
};

const LocationContext = createContext<LocationContextValue | null>(null);

/**
 * LocationProvider配下でのみ使用可能。端末の現在地監視の状態のみを共有する
 * (「どこで止めるか」という停止方法の定義は src/contexts/StopMethodProvider.tsx が持つ)。
 */
export function useLocation(): LocationContextValue {
  const ctx = useContext(LocationContext);
  if (!ctx) throw new Error("useLocation must be used within LocationProvider");
  return ctx;
}

export default function LocationProvider({ children }: { children: React.ReactNode }) {
  const notify = useNotify();
  const [permission, setPermission] = useState<LocationPermission>("prompt");
  const [watching, setWatching] = useState(false);
  const [currentPosition, setCurrentPosition] = useState<CurrentPosition | null>(null);
  const watchIdRef = useRef<number | null>(null);

  // 初回マウント時に対応状況を判定
  useEffect(() => {
    const supported = typeof navigator !== "undefined" && "geolocation" in navigator;
    const secure = typeof window !== "undefined" && window.isSecureContext;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPermission(!supported ? "unsupported" : !secure ? "insecure" : "prompt");
  }, []);

  // アンマウント時に位置情報の監視を確実に止める
  useEffect(() => {
    return () => {
      if (watchIdRef.current != null) navigator.geolocation.clearWatch(watchIdRef.current);
    };
  }, []);

  const startWatching = useCallback(() => {
    if (watchIdRef.current != null) return;
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) return;
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        setCurrentPosition({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        });
        setWatching(true);
        setPermission("granted");
      },
      (err) => {
        setWatching(false);
        setPermission(err.code === err.PERMISSION_DENIED ? "denied" : "prompt");
        notify("error", `位置情報の取得に失敗しました: ${err.message}`);
      },
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 15000 },
    );
    watchIdRef.current = id;
  }, [notify]);

  const value: LocationContextValue = {
    permission,
    watching,
    startWatching,
    currentPosition,
  };

  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>;
}
