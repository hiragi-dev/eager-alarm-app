import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import staticAssetsIncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/static-assets-incremental-cache";

// 全ページSSG(revalidateなし)なので、ビルド時生成物をWorkers Static Assetsから
// 読み取り専用で配信する。デフォルトのダミーキャッシュだとプリレンダリング済み
// ページが404になる。ISRを使い始めたらR2 incremental cacheへの切替が必要。
export default defineCloudflareConfig({
  incrementalCache: staticAssetsIncrementalCache,
  enableCacheInterception: true,
});
