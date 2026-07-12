# Alarm

Raspberry Pi 上で動く `eager-alarm-edge`（アラームスケジューラ）を MQTT でリモート制御する
IoT アプリ。PWA化を見据えた Next.js (App Router) + Material UI (MUI) + TypeScript 構成です。

下部のボトムナビゲーションに3つのタブがあります（「停止」タブはさらにサブタブに分かれます）。

- **設定** — MQTT設定 / 位置情報 / 歩行検知 の3つの設定画面へのメニュー
  - **MQTT設定** — ブローカーへの接続設定、簡易な ON/OFF コマンド送信、通信ログ。
    ブローカーURL・デバイスIDが確定済み（`.env.local`またはlocalStorageに保存済み）の場合、
    アプリ起動時に一度だけ自動接続を試みる（`src/contexts/MqttProvider.tsx`）。
    接続後の切断（モバイルでのバックグラウンド遷移によるWebSocket切断など）に対しては、
    mqtt.js自身の自動再接続（`reconnectPeriod`）に加えて、アプリがフォアグラウンドに
    復帰した際（`visibilitychange`）にも生存確認を行い、必要なら接続を張り直す
  - **位置情報** — 現在地取得の許可状況の確認・取得開始（`src/components/LocationSettings.tsx`）。
    停止地点そのものの登録は「停止」タブの「停止方法」で行う
  - **歩行検知** — 加速度センサーの許可状況の確認・動作確認（`src/components/WalkSensorSettings.tsx`）
- **アラーム** — `eager-alarm-edge` のアラーム追加・編集・削除（`src/components/AlarmControl.tsx`）。
  時刻・繰り返す曜日・有効/無効に加え、**このアラームをどの停止方法で止めるか**を必須で選択する
- **停止** — サブタブが2つあります
  - **アラームを止める** — 鳴動中のアラーム状況（歩行検知状態、割り当てられた停止方法までの距離）を
    表示し、手動で今すぐ止めるボタンも提供する（`src/components/StopAlarmControl.tsx`）
  - **停止方法** — 位置情報ベースの停止方法（名前・地図で選んだ地点・到達判定半径）を登録・削除する
    （`src/components/StopMethodSettings.tsx`）。いずれかのアラームに割り当て済みの停止方法は削除できない

接続状態・アラーム一覧は `src/contexts/MqttProvider.tsx`、センサー値・歩行検知状態は
`src/contexts/WalkSensorProvider.tsx`、現在地は `src/contexts/LocationProvider.tsx`、
登録済みの停止方法一覧は `src/contexts/StopMethodProvider.tsx` の Context でタブ間・ページ全体に
共有されるため、タブを切り替えても再接続やセンサー購読・位置情報監視の再開は不要です。

### 機能の利用可否（状態の代数化）

MQTTブローカーへの接続状況・edgeデバイスの生存状況から「今アラーム関連の操作を行ってよいか」を
一意に導出できるよう、`src/lib/appState.ts` に代数的データ型(discriminated union)と導出関数を
まとめています。

- `BrokerConnection` — MQTTブローカーへの接続状態
- `EdgeDeviceStatus`（`src/contexts/MqttProvider.tsx`） — edgeデバイス自体の生存状況
  （ブローカー接続とは別物として扱う。詳細は後述の「edgeデバイスのオンライン/オフライン検知」参照）
- `AlarmManagementReadiness` — アラームの追加/編集/削除・停止方法の割り当て・手動停止を
  許可してよいかの最終判定。ブロックされている場合は理由(`BlockReason[]`)を持つ

これは `src/hooks/useAppReadiness.ts` が `MqttProvider` の生の状態から都度導出する純粋な関数で、
保持している状態そのものではありません。`AlarmControl`/`StopAlarmControl` はこの結果だけを見て
ボタンの活性/非活性や表示を決めるため、「この状態のUIから何ができるか」が型として明確になります。
問題がない場合は理由の表示自体を出さないため、通常時の画面は要素が少なくシンプルなままです。
なお、停止方法(位置情報)自体の登録・削除はブラウザのlocalStorageのみで完結する操作のため、
このゲーティングの対象外です（MQTT接続の有無に関わらずいつでも行えます）。

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
  `.../status`（生存確認応答、旧ON/OFFデモのackも同トピック）, `.../alarms`（アラーム一覧の返信）,
  `.../ringing_status`（鳴動状況の返信）
- ブローカーは **自分で用意した HiveMQ Cloud**（TLS 認証付き）を使用。
  - ブラウザ: WebSocket `wss://xxxx.s1.eu.hivemq.cloud:8884/mqtt`
  - Pi: `xxxx.s1.eu.hivemq.cloud:8883`（TLS）
- 実装: アプリ側 `src/contexts/MqttProvider.tsx`・`src/lib/mqtt.ts`・`src/lib/alarm.ts` /
  Pi側は別リポジトリ `eager-alarm-edge`（Rust）。旧ON/OFFデモ用の購読スクリプトは `pi/subscriber.py`
- **配信品質**: アラーム操作（`add`/`edit`/`delete`/`pause`/`stop`）は **QoS 2（Exactly Once）**
  で publish・subscribe します。ネットワークが不安定でも操作が重複したり失われたりしないことを保証するためです

### 実機無しでのテスト（edge-mock）

`eager-alarm-edge` 実機（Raspberry Pi）が無くても、`mock/edge-mock.mjs` で
アプリ側のコマンド往復・鳴動状態の遷移をテストできます。詳しくは [`mock/README.md`](mock/README.md) を参照。

```bash
npm run mock:edge
```

### アラームAPI（`eager-alarm-edge` 側の仕様、v2）

`command` トピックへ publish する JSON の `type` で振り分けられます。

| type | ペイロード | 説明 |
|---|---|---|
| `add` | `{"type":"add","time":"HH:MM","days_of_week":["Mon","Wed"],"is_enabled":true,"stop_method_id":"<uuid>"}` | アラーム追加。時刻はデバイスのローカル時刻。曜日は繰り返し。id はedge側で生成 |
| `edit` | `{"type":"edit","id":"<uuid>","time":"HH:MM","days_of_week":[...],"is_enabled":true,"stop_method_id":"<uuid>"}` | 既存アラームの更新（有効/無効の切り替えもこれで行う） |
| `delete` | `{"type":"delete","id":"<uuid>"}` | アラーム削除 |
| `list` | `{"type":"list"}` | 一覧取得。応答は `alarms` トピックに `[{id, time, days_of_week, is_enabled, stop_method_id}, ...]`（時刻の早い順） |
| `pause` | `{"type":"pause","duration_ms":5000}` | 鳴動中のアラームを `duration_ms` ミリ秒だけ一時停止する。明示的な resume は無く、時間経過で自動再開する想定 |
| `stop` | `{"type":"stop"}` | 鳴動中のアラームを完全に停止する（アラーム自体は削除されず、次回の曜日に再スケジュールされる） |
| `status` | `{"type":"status"}` | 生存確認。edgeデバイスは `status` トピックへ即座に応答する想定（ペイロード例: `{"online":true}`。アプリ側は応答の有無だけで判定するため内容は問わない） |
| `ringing_status` | `{"type":"ringing_status"}` | 鳴動状況の取得。応答は `ringing_status` トピックに `{"is_ringing":bool,"ringing_ids":["<uuid>",...]}` |

`stop_method_id` はブラウザ側（`StopMethodProvider`、下記参照）が管理する位置情報ベースの停止方法の
IDをそのまま保持して返すだけの不透明な値で、edge側はこの値の意味を解釈しません。

アプリは接続確立時に自動で `list`/`ringing_status` を送信し、以後は `alarms`/`ringing_status`
トピックのメッセージで一覧・鳴動状況を更新します（`src/lib/alarm.ts` の各 `build*Command` 関数）。
`ringing_status` はさらに3秒おきにポーリングして最新の鳴動状況を維持します
（`src/contexts/MqttProvider.tsx`）。

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
`src/lib/appState.ts` の `deriveAlarmManagementReadiness` が
アラーム関連タブの操作可否判定にも利用します（edgeがオフラインの間は追加/削除/手動停止操作をブロック）。

### 停止方法（位置情報ベース）

「アラームを止める」ためのやり方（今のところ位置情報ベースのみ対応）を、名前を付けて複数登録できます。
ブラウザのlocalStorageのみで完結する概念で、edgeデバイスには座標そのものは送信しません
（`src/lib/stopMethod.ts` の `StopMethod` 型、`src/contexts/StopMethodProvider.tsx`）。

- 登録: 「停止」タブ→「停止方法」→「追加」。まず全画面の地図で地点を選び、次に名前・到達判定半径を
  入力する2ステップのフロー。地図には [Leaflet](https://leafletjs.com/) + OpenStreetMapタイルを使用
  （`src/components/LocationPickerMap.tsx`、APIキー不要）。Leafletはwindow/documentに依存しSSR非対応の
  ため `next/dynamic(..., { ssr: false })` で読み込みます
- 削除: いずれかのアラームに割り当て済みの停止方法は削除できません（`src/components/StopMethodSettings.tsx`
  が `useMqtt().alarms` を見て使用中かどうかを判定し、削除ボタンを無効化する）
- アラームへの割り当て: 「アラーム」タブの追加/編集ダイアログで、登録済みの停止方法から1つを**必須で**選択する
  （`src/lib/alarm.ts` の `Alarm.stop_method_id` / `AlarmCommand` の `add`/`edit`）

### 「アラームを止める」フロー（歩行検知 + 位置情報）

アラームごとに紐づいた停止方法があらかじめ分かっているため、手動で「有効化」する操作は無く、
鳴動中は自動的に以下の2つがMQTT接続中に限り動作します。

1. **歩行検知中は `pause` を自動送信**（一時停止。停止方法の設定に関わらず、鳴動中いつでも働く）
   - 歩行検知: `src/hooks/useWalkingDetector.ts`。`devicemotion` の加速度（重力込み）の大きさが
     立ち上がり→下降に転じる「ピーク」を歩数としてカウントし、直近3秒間に3歩以上あれば歩行中と
     判定する簡易的なヒューリスティックです。しきい値は端末や持ち方によって精度が変わるため、
     実機で試しながら定数を調整してください
   - 送信ロジック: `src/components/WalkPauseBridge.tsx`（UIを持たない橋渡しコンポーネント）。
     `ringing_status.is_ringing` が true かつ歩行検知中の間、2秒おきに `duration_ms: 5000` の
     `pause` を再送し、歩行が続く限り停止状態を延長します。歩行が止まれば再送も止まります
2. **鳴動中のアラームに割り当てられた停止方法の地点に到達したら `stop` を送信**（完全停止）
   - 現在地の監視: `src/contexts/LocationProvider.tsx`。`navigator.geolocation.watchPosition` で
     現在地を継続取得し、`ringing_status.ringing_ids` に含まれる各アラームの `stop_method_id` を
     `StopMethodProvider` の一覧から解決した地点との距離をハーバーサイン公式（`src/lib/geo.ts`）で
     計算します
   - 送信ロジック: `src/components/ArrivalStopBridge.tsx`。鳴動中のアラームがあれば自動的に現在地監視を
     開始し、割り当てられた停止方法の半径内に入ったら停止処理を開始します（複数アラームが同時に鳴動
     している場合、`stop` コマンド自体はどのアラームを止めるか指定できない簡易な仕様のため、実質的には
     最初に到達した1件で全体が止まります）
   - 位置情報の取得にもセキュアコンテキスト（HTTPS または localhost）が必要です

**設計意図**: このアプリは「設定した停止地点に到達するまで確実にアラームを止められない」ことを
意図しており、手動の「今すぐ止める」ボタンのようなフェイルセーフは意図的に設けていません。
到達を検知すると、`ArrivalStopBridge.tsx`は以下を保証するブロッキングのポップアップを表示します
（Escape・背景クリックでは閉じられません）。

1. `stop`をQoS2で送信し、ブローカーへの配信確認（PUBCOMP）が取れるまで「送信しています…」を表示
2. 配信確認後、`ringing_status`のポーリング（3秒間隔）で当該アラームが実際に鳴動を終えたことが
   確認できるまで「停止を確認しています…」を表示
3. 配信に失敗した場合は3秒後に自動再送、配信は成功したが8秒経っても停止が確認できない場合も
   自動的に`stop`を再送します（Exactly-onceの配信保証はブローカー〜アプリ間のみで、edge側の
   処理成功までは保証しないため、確認が取れるまで送り続けることで実質的な確実性を担保しています）
4. 停止を確認できたら成功表示に切り替わり、数秒後に自動で（または「閉じる」ボタンで）閉じます

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
