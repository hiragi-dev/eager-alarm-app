import { networkInterfaces } from "node:os";
import type { NextConfig } from "next";

/** 同一ネットワーク内のスマホ実機から dev サーバーにアクセスできるよう、LAN上のIPv4アドレスを自動検出する */
function lanIpv4Addresses(): string[] {
  const addresses: string[] = [];
  for (const ifaces of Object.values(networkInterfaces())) {
    for (const iface of ifaces ?? []) {
      if (iface.family === "IPv4" && !iface.internal) {
        addresses.push(iface.address);
      }
    }
  }
  return addresses;
}

const nextConfig: NextConfig = {
  // 親ディレクトリにロックファイルが紛れ込むとワークスペースルートが誤認され、
  // Turbopackがworkspace全体をスキャンしてサーバーが応答不能になるため明示する
  turbopack: {
    root: import.meta.dirname,
  },
  // dev サーバーの _next リソース(HMR等)へのクロスオリジンアクセスを、
  // 同一LAN内のスマホ実機からのアクセスに限り許可する。
  allowedDevOrigins: lanIpv4Addresses(),
  async headers() {
    return [
      {
        // Service Worker本体がHTTPキャッシュされると新バージョンの配信が
        // 遅れるため、常に再検証させる
        source: "/sw.js",
        headers: [
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
        ],
      },
      {
        // HTML(ドキュメント)も毎回再検証させる。既定では s-maxage だけが付き、
        // ブラウザ向けの max-age も ETag も無い状態になるため、古いHTMLが端末に
        // 残って「デプロイしても更新されない」状態になり得る。それを解消しようと
        // サイトデータを消去するとlocalStorage(MQTT設定・停止方法)まで消えるため、
        // 更新が黙って届くことを設定の永続性の前提として扱う。
        // ハッシュ付きの /_next/static/* は不変なので対象にしない(ページを増やす際は
        // ここのsourceも追加すること)。
        source: "/",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=0, must-revalidate",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
