// このアプリはMQTTのリアルタイム状態(鳴動状況・停止確認)に依存しており、
// 古いキャッシュから起動すると「実際は鳴っているのに停止済みに見える」等の
// 危険な表示になり得るため、オフラインキャッシュは意図的に行わない。
// Service Workerはインストール可能なPWAとしての要件と、将来のWeb Push対応の
// 土台としてのみ機能する。

self.addEventListener("install", () => {
  // 旧バージョンのSWを待たずに即座に置き換える
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  // 既に開いているタブも即座に新しいSWの管理下に置く
  event.waitUntil(self.clients.claim());
});
