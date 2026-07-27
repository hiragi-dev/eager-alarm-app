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
    ];
  },
};

export default nextConfig;
