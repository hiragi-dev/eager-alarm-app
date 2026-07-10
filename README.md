# Alarm

Raspberry Pi を MQTT でリモート制御する IoT アプリ。PWA化を見据えた
Next.js (App Router) + Material UI (MUI) + TypeScript 構成です。

## MQTT 送信デモ

ブラウザ（配布アプリ側）から MQTT over WebSocket でコマンドを送信し、
Raspberry Pi 側の購読スクリプトへ届くかを確認するデモを同梱しています。

### アーキテクチャ

```
[ブラウザ/PWA] --publish--> [MQTTブローカー] <--subscribe-- [Raspberry Pi]
   ON/OFF送信                broker.hivemq.com              paho-mqtt
       ^--------------------- status/ack ---------------------|
```

- トピック: `alarm-demo/<デバイスID>/command`（コマンド）, `.../status`（ack）
- デフォルトはアカウント不要の公開ブローカー `broker.hivemq.com`
  （ブラウザ: `wss://…:8884/mqtt` / Pi: `…:1883`）。本番は HiveMQ Cloud 等の
  認証付きブローカーに差し替え可能。
- 実装: アプリ側 `src/components/MqttControl.tsx`・`src/lib/mqtt.ts` /
  Pi側 `pi/subscriber.py`

### 試し方

1. アプリを起動: `npm run dev` → http://localhost:3000 を開く
2. 画面に表示された **デバイスID** を控える
3. Pi（またはローカルPC）で購読スクリプトを起動（`pi/README.md` 参照）:
   ```bash
   cd pi && pip install -r requirements.txt
   DEVICE_ID=<控えたID> python3 subscriber.py
   ```
4. アプリで「接続」→「ON / OFF」を押す。Pi側に受信ログ、アプリ側に ack が出れば成功

> 公開ブローカーは誰でも購読・publishできるテスト用です。デバイスIDは一意にし、
> 本番では認証付き＋トピックACLのブローカーを使ってください。

## 構成

- **Next.js 16** (App Router, TypeScript, ESLint)
- **Material UI** — `@mui/material-nextjs` の `AppRouterCacheProvider` で emotion の SSR キャッシュに対応 (`src/app/layout.tsx`)
- テーマ定義: `src/theme/theme.ts`
- PWA向けの下地:
  - `public/manifest.json`（name / icons / display: standalone / theme_color 等）
  - `public/icons/icon-192x192.png`, `public/icons/icon-512x512.png`（プレースホルダーアイコン。元データは `public/icons/icon.svg`）
  - `src/app/layout.tsx` の `metadata.manifest` / `viewport.themeColor` / `appleWebApp`

## セットアップ

依存関係のインストールは完了済みです。追加でインストールする場合は以下を実行してください。

```bash
npm install
```

## 開発

```bash
npm run dev
```

[http://localhost:3000](http://localhost:3000) を開いて確認してください。

## ビルド

```bash
npm run build
npm run start
```

## 今後のPWA化について

このプロジェクトはまだ Service Worker を実装していません（オフラインキャッシュ・プッシュ通知などは未対応）。本格的にPWA化する際は以下を検討してください。

1. `@ducanh2912/next-pwa` などのプラグインを導入し、`next.config.ts` で Service Worker を自動生成する
2. キャッシュ戦略（Cache First / Network First など）をルートごとに設計する
3. `public/manifest.json` のアイコン・スクリーンショットを本番用のデザインに差し替える
4. Lighthouse の PWA 監査（Chrome DevTools > Lighthouse）でインストール可能性・オフライン動作を確認する
5. iOS Safari 向けに `apple-touch-icon` や `appleWebApp` の設定を必要に応じて拡充する

## Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [Material UI Documentation](https://mui.com/material-ui/getting-started/)
