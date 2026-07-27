"use client";

import { useEffect } from "react";

/**
 * Service Worker(/sw.js)を登録するだけの不可視コンポーネント。
 * layout.tsxで常時マウントし、PWAとしてホーム画面にインストール可能にする。
 * updateViaCache: "none" により、sw.js自体がブラウザのHTTPキャッシュに
 * 残って更新されない事態を防ぐ。
 */
export default function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .catch((error) => {
        // 登録に失敗してもアプリ本体の動作には影響しない(PWA機能が使えないだけ)
        console.error("Service Workerの登録に失敗しました:", error);
      });
  }, []);

  return null;
}
