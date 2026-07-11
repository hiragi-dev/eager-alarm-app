# Alarm

Raspberry Pi 上で動く `eager-alarm-edge`（アラームスケジューラ）を MQTT でリモート制御する
IoT アプリ。PWA化を見据えた Next.js (App Router) + Material UI (MUI) + TypeScript 構成です。

画面は5つのタブに分かれています。

- **MQTT設定** — ブローカーへの接続設定、簡易な ON/OFF コマンド送信、通信ログ。
  ブローカーURL・デバイスIDが確定済み（`.env.local`またはlocalStorageに保存済み）の場合、
  アプリ起動時に一度だけ自動接続を試みる（`src/contexts/MqttProvider.tsx`）
- **アラーム** — `eager-alarm-edge` のアラーム追加・一覧・削除（`src/components/AlarmControl.tsx`）
- **アラームを止める** — 歩行検知状況を一目で表示し、「アラームを止める」ボタンで
  停止シーケンスを開始する。歩行検知中は `pause` を、登録地点への到達時は `stop` を自動送信する
  （`src/components/StopAlarmControl.tsx`）
- **位置情報** — アラームを完全停止する地点（現在地）と到達判定半径を登録する
  （`src/components/LocationSettings.tsx`）
- **ジャイロ** — スマホの傾き・回転速度・加速度センサー、歩行検知結果の動作確認
  （`src/components/GyroTest.tsx`）

接続状態・アラーム一覧は `src/contexts/MqttProvider.tsx`、センサー値・歩行検知状態は
`src/contexts/GyroProvider.tsx`、現在地・停止地点は `src/contexts/LocationProvider.tsx`、
「アラームを止める」フローの有効/無効は `src/contexts/StopSequenceProvider.tsx` の
Context でタブ間・ページ全体に共有されるため、タブを切り替えても再接続やセンサー購読・
位置情報監視の再開は不要です。

### 機能の利用可否（状態の代数化）

edgeデバイスの接続状況・位置情報の許可状況・アラーム停止方法の有無から「今どの機能が使えるか」を
一意に導出できるよう、`src/lib/appState.ts` に代数的データ型(discriminated union)と導出関数を
まとめています。

- `DeviceConnection` — edgeデバイスとのMQTT接続状態
- `WalkDetectionReadiness` / `LocationDetectionReadiness` — 歩行検知・位置情報それぞれが使える状態か
- `StopMethod` — 上記2つから導出される「アラームを止める」ために今使える手段の組み合わせ
  （`none` / `walk-only` / `location-only` / `walk-and-location`）
- `StopFlowReadiness` / `AlarmManagementReadiness` — 各タブの操作を許可してよいかの最終判定。
  ブロックされている場合は理由(`BlockReason[]`)を持つ

これらは `src/hooks/useAppReadiness.ts` が各Providerの生の状態から都度導出する純粋な関数で、
保持している状態そのものではありません。`AlarmControl`/`StopAlarmControl` はこの結果だけを見て
ボタンの活性/非活性や表示を決めるため、「この状態のUIから何ができるか」が型として明確になります。
問題がない場合は理由の表示自体を出さないため、通常時の画面は要素が少なくシンプルなままです。

### エラーの通知

各Providerで発生したエラー（MQTT接続/送信失敗、センサー許可エラー、位置情報取得エラー等）は、
文字列をそのまま画面に埋め込むのではなく `src/contexts/NotificationProvider.tsx` の
`useNotify()` を通じてポップアップ(Snackbar)で表示します。複数のエラーが短時間に発生した場合も
1件ずつ順番に表示されます（MUI公式の「連続するSnackbar」パターン）。

### アーキテクチャ

```
[ブラウザ/PWA] --publish--> [HiveMQ Cloud] <--subscribe-- [Raspberry Pi]
  command送信          （個人ブローカー/TLS認証）      eager-alarm-edge
       ^------------------ status/alarms ---------------------|
```

- トピック: `eager-alarm/<デバイスID>/command`（コマンド送信）,
  `.../status`（ON/OFFデモのack）, `.../alarms`（アラーム一覧の返信）
- ブローカーは **自分で用意した HiveMQ Cloud**（TLS 認証付き）を使用。
  - ブラウザ: WebSocket `wss://xxxx.s1.eu.hivemq.cloud:8884/mqtt`
  - Pi: `xxxx.s1.eu.hivemq.cloud:8883`（TLS）
- 実装: アプリ側 `src/contexts/MqttProvider.tsx`・`src/lib/mqtt.ts`・`src/lib/alarm.ts` /
  Pi側は別リポジトリ `eager-alarm-edge`（Rust）。旧ON/OFFデモ用の購読スクリプトは `pi/subscriber.py`
- **配信品質**: アラーム操作（`add`/`delete`/`pause`/`stop`）は **QoS 2（Exactly Once）**
  で publish・subscribe します。ネットワークが不安定でも操作が重複したり失われたりしないことを保証するためです

### 実機無しでのテスト（edge-mock）

`eager-alarm-edge` 実機（Raspberry Pi）が無くても、`mock/edge-mock.mjs` で
アプリ側のコマンド往復・鳴動状態の遷移をテストできます。詳しくは [`mock/README.md`](mock/README.md) を参照。

```bash
npm run mock:edge
```

### アラームAPI（`eager-alarm-edge` 側の仕様）

`command` トピックへ publish する JSON の `type` で振り分けられます。

| type | ペイロード | 説明 |
|---|---|---|
| `add` | `{"type":"add","wakeup_time":"YYYY-MM-DD HH:MM:SS"}` | アラーム追加。日時はデバイスのローカル時刻 |
| `delete` | `{"type":"delete","id":"<uuid>"}` | アラーム削除 |
| `list` | `{"type":"list"}` | 一覧取得。応答は `alarms` トピックに `[{id, wakeup_time}, ...]`（起床時刻の早い順） |
| `pause` | `{"type":"pause","duration_ms":5000}` | 鳴動中のアラームを `duration_ms` ミリ秒だけ一時停止する。明示的な resume は無く、時間経過で自動再開する想定 |
| `stop` | `{"type":"stop"}` | 鳴動中のアラームを完全に停止する。`pause`と異なり自動再開は無い |
| `status` | `{"type":"status"}` | 生存確認。edgeデバイスは `status` トピックへ即座に応答する想定（ペイロード例: `{"online":true}`。アプリ側は応答の有無だけで判定するため内容は問わない） |

アプリは接続確立時に自動で `list` を送信し、以後は `alarms` トピックのメッセージで
一覧を更新します（`src/lib/alarm.ts` の `buildAddCommand` / `buildDeleteCommand` / `buildListCommand` /
`buildPauseCommand` / `buildStopCommand` / `buildStatusCommand`）。

### edgeデバイスのオンライン/オフライン検知

**MQTTブローカーへの接続状況**と**edgeデバイス自体の生存状況**は別物として扱います
（ブローカーには接続できていても、Pi本体の電源が落ちている・フリーズしているケースがあるため）。

- ブローカー接続中は5秒おきに `status` コマンドを送信し（`src/contexts/MqttProvider.tsx`）、
  `status` トピックへの応答（`status`コマンドへの応答に限らず、当該トピックへのpublish全般）を
  「生存の証拠」として扱う
- 直近13秒間（ポーリング間隔の約2.5倍）応答が無ければ `offline` と判定する
- ブローカー未接続の間は判定できないため `unknown`（`offline`とは区別する）
- `status`（`eager-alarm-edge`側は現状未実装）は現在このpingにのみ使われるため、
  実機側が実装するまでは常に `offline` と表示される

状態は `useMqtt().edgeStatus`（`"unknown" | "online" | "offline"`）として公開され、
「MQTT設定」タブでブローカー接続状態とは別のChipとして表示されるほか、
`src/lib/appState.ts` の `deriveAlarmManagementReadiness` / `deriveStopFlowReadiness` が
アラーム関連タブの操作可否判定にも利用します（edgeがオフラインの間は追加/削除/アラームを止める操作をブロック）。

### 「アラームを止める」フロー（歩行検知 + 位置情報）

「アラームを止める」タブのボタンを押すと停止シーケンスが**有効(armed)**になり、以下の2つが
MQTT接続中に限り自動的に動作します。実機へ意図せずコマンドが送られないよう、既定は無効で、
ページを再読み込みすると無効に戻ります（`src/contexts/StopSequenceProvider.tsx`、非永続）。

1. **歩行検知中は `pause` を自動送信**（一時停止）
   - 歩行検知: `src/hooks/useWalkingDetector.ts`。`devicemotion` の加速度（重力込み）の大きさが
     立ち上がり→下降に転じる「ピーク」を歩数としてカウントし、直近3秒間に3歩以上あれば歩行中と
     判定する簡易的なヒューリスティックです。しきい値は端末や持ち方によって精度が変わるため、
     実機で試しながら定数を調整してください
   - 送信ロジック: `src/components/WalkPauseBridge.tsx`（UIを持たない橋渡しコンポーネント）。
     歩行検知中は2秒おきに `duration_ms: 5000` の `pause` を再送し、歩行が続く限り停止状態を
     延長します。歩行が止まれば再送も止まります
2. **登録地点に到達したら `stop` を1回送信**（完全停止）してフローを自動解除
   - 現在地の監視・停止地点の登録: `src/contexts/LocationProvider.tsx`（「位置情報」タブから設定）。
     `navigator.geolocation.watchPosition` で現在地を継続取得し、登録地点との距離を
     ハーバーサイン公式（`src/lib/geo.ts`）で計算します
   - 送信ロジック: `src/components/ArrivalStopBridge.tsx`（UIを持たない橋渡しコンポーネント）。
     登録地点から半径内に入った瞬間に `stop` を1回だけ送信し、`markStopped()` でフローを自動的に
     無効化します（同じ地点に留まり続けても連投はしません）
   - 位置情報の取得にもセキュアコンテキスト（HTTPS または localhost）が必要です

### 認証情報の扱い（テスト / 本番）

| | ブローカーURL・ユーザー名・パスワード | 仕組み |
|---|---|---|
| **テスト（開発）** | env とアプリ画面の両方から設定可 | `.env.local` の `NEXT_PUBLIC_MQTT_*` を初期値として読み込み、画面で上書きも可能 |
| **本番** | アプリ画面のみから設定 | 本番ビルドでは env を一切読まない（`process.env.NODE_ENV` 判定で該当コードごと除去され、認証情報はクライアントバンドルに埋め込まれない） |

開発時のセットアップ:

```bash
cp .env.example .env.local   # NEXT_PUBLIC_MQTT_BROKER_URL / USERNAME / PASSWORD を記入
```

`.env.local` は Git 管理対象外です。`NEXT_PUBLIC_*` はブラウザへ配信されるため、
ここに置いてよいのは **開発用ブローカーの認証情報だけ** です。

### 試し方

1. `.env.local` に HiveMQ Cloud の接続情報を記入（上記）
2. アプリを起動: `npm run dev` → http://localhost:3000 を開く
3. 画面に表示された **デバイスID** を控える
4. Pi（またはローカルPC）で購読スクリプトを起動（`pi/README.md` 参照）:
   ```bash
   cd pi && pip install -r requirements.txt
   cp .env.example .env   # HiveMQ Cloud の情報を記入し DEVICE_ID を控えたIDに
   set -a; . ./.env; set +a
   python3 subscriber.py
   ```
5. アプリで「接続」→「ON / OFF」を押す。Pi側に受信ログ、アプリ側に ack が出れば成功

> デバイスIDは一意にし、本番ではトピックごとの ACL でデバイスを分離してください。

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

### スマホ実機からのアクセス（同一ネットワーク）

「ジャイロ」タブのセンサー（DeviceOrientation / DeviceMotion）はブラウザの
**セキュアコンテキスト**（HTTPS または localhost）でないと動作しません。
同じWi-FiのスマホからPCのIPアドレスでアクセスする場合は HTTPS 版のdevサーバーを使います。

```bash
npm run dev:https
```

初回のみ、LANのIPアドレスを含む自己署名証明書を作成してください（`certificates/`配下、Git管理対象外）。

```bash
npm run cert:renew
```

（内部で `scripts/renew-cert.sh` を実行し、現在のLAN IPを含む証明書を
`certificates/localhost.pem` / `localhost-key.pem` に生成します）

起動後に表示される `Network: https://<PCのIP>:3000` にスマホからアクセスします。
自己署名証明書のため初回はブラウザに警告が出ますが、「詳細設定」→「このまま進む」等で
先に進めば閲覧できます（警告が出ても接続自体はHTTPSなのでセンサーAPIは動作します）。
PCのファイアウォールで着信接続がブロックされている場合はスマホから繋がらないので、
必要に応じて許可してください。

> **DHCP環境ではPCのLAN IPが変わることがあります。** 証明書のSANが古いIPのままだと
> スマホから接続できなくなるので、繋がらなくなったら `npm run cert:renew` を実行して
> `npm run dev:https` を再起動してください。

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
