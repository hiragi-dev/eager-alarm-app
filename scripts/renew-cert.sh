#!/usr/bin/env bash
# 現在のLAN IPを含む自己署名証明書を再生成する。
# DHCP環境ではIPが変わることがあり、証明書のSANが古いIPのままだと
# `npm run dev:https` でスマホ実機から接続できなくなる（本スクリプトはその復旧用）。
set -euo pipefail

cd "$(dirname "$0")/.."

LAN_IP="$(ipconfig getifaddr en0 2>/dev/null || true)"
if [ -z "$LAN_IP" ]; then
  echo "LAN IPを取得できませんでした（en0以外のインターフェースを使っている場合は手動で指定してください）" >&2
  exit 1
fi

mkdir -p certificates
openssl req -x509 -newkey rsa:2048 -nodes \
  -keyout certificates/localhost-key.pem \
  -out certificates/localhost.pem \
  -days 365 \
  -subj "/CN=localhost" \
  -addext "subjectAltName=DNS:localhost,IP:127.0.0.1,IP:${LAN_IP}"

echo "証明書を再生成しました (LAN IP: ${LAN_IP})"
openssl x509 -in certificates/localhost.pem -noout -text | grep -A1 "Subject Alternative Name"
