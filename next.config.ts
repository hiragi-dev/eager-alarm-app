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
  // dev サーバーの _next リソース(HMR等)へのクロスオリジンアクセスを、
  // 同一LAN内のスマホ実機からのアクセスに限り許可する。
  allowedDevOrigins: lanIpv4Addresses(),
};

export default nextConfig;
