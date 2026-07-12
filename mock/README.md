# edge-mock

実機の Raspberry Pi（`eager-alarm-edge`）無しで、アプリ側の MQTT コマンド（`add` /
`delete` / `list` / `pause` / `stop` / `status`）の往復と鳴動状態の遷移をテストするためのモックです。

`eager-alarm-edge` の現行実装（`add`/`delete`/`list`のみ）に加えて、まだ実機側に
実装されていない `pause`/`stop`/`status` も含めた**合意済みAPI仕様の参照実装**になっています。
実機側の実装が本物と一致しているかを確認する際の比較対象としても使えます。

## 使い方

```bash
npm run mock:edge
```

アプリと同じ `.env.local`（`NEXT_PUBLIC_MQTT_BROKER_URL` / `NEXT_PUBLIC_MQTT_USERNAME` /
`NEXT_PUBLIC_MQTT_PASSWORD` / `NEXT_PUBLIC_MQTT_DEVICE_ID`）を読み込んで接続します。
未設定の場合は `cp .env.example .env.local` してから値を埋めてください。

起動すると `eager-alarm/<デバイスID>/command` を QoS 2 で購読し、`eager-alarm/<デバイスID>/alarms`
へ QoS 2 で応答します。ログはすべて標準出力に絵文字付きで出るので、コマンドの効果を目視で確認できます。

```
[10:00:00] 接続しました device=pi broker=wss://...
[10:00:00] 購読開始: eager-alarm/pi/command (QoS 2)
[10:00:05] ✅ add id=3fa8... time=10:10 days=[Mon,Tue,Wed,Thu,Fri] stop_method_id=8b2c...
[10:10:00] 🔔🔔🔔 ALARM RINGING id=3fa8... time=10:10
[10:10:02] 🔔 鳴動中... id=3fa8...
[10:10:03] 😴 pause: 5000ms 停止 (muted_until=10:10:08)
[10:10:08] 🔔 鳴動中... id=3fa8...
[10:10:09] 🛑 stop: 鳴動中のアラーム id=3fa8... を停止しました（アラームは保持）
```

## 実装している状態遷移（v2 API）

- アラームは `time`(HH:MM) + `days_of_week` + `is_enabled` + `stop_method_id` で管理する
  （旧 `wakeup_time` 形式ではない）。`stop_method_id` はブラウザ側(`StopMethodProvider`)が
  発行するIDをそのまま保持して返すだけの不透明な値で、モックはこの値の意味を解釈しない
- 有効な曜日・時刻を毎tick確認し、一致したら「鳴動中」に遷移する（v1と異なりアラームは
  スケジュールから削除されない。次回の該当曜日にまた鳴動する）
- `pause`: `duration_ms` 後まで鳴動（への遷移・継続）を抑制する `muted_until` を**上書き**で延長する
  （積算しない。歩行検知中にアプリが数秒おきに再送する前提のため）
- `stop`: 鳴動中のアラームを停止し、`muted_until` もクリアする（アラーム自体は削除しない）
- `delete` が鳴動中のアラームに対して送られた場合も、その場で鳴動を停止する
- `status`: 受信したら即座に `status` トピックへ `{"online":true}` を応答する。
  アプリはブローカー接続中5秒おきにこのコマンドを送っており、応答があれば「オンライン」、
  13秒間応答が無ければ「オフライン」と判定する（このモックは常に即応するので、
  接続直後しばらくすると常時オンライン表示になるはず）
- `ringing_status`: 受信したら即座に `ringing_status` トピックへ
  `{"is_ringing": bool, "ringing_ids": [...]}` を応答する（同時に鳴動するのは常に最大1件）

## 動作確認の例

1. `npm run mock:edge` を起動
2. アプリの「停止」タブ→「停止方法」で位置情報ベースの停止方法を1つ登録
3. アプリの「MQTT設定」タブで接続 → 「アラーム」タブで数分後に鳴るアラームを追加
   （停止方法は手順2で登録したものを選択）
4. モックのログで `ALARM RINGING` を確認（アプリにも鳴動中の通知が出るはず）
5. アプリの「停止」タブ→「アラームを止める」で実機/PC等を振って歩行を検知させる →
   モックのログに `pause` 受信と静音化が出ることを確認
6. 登録した停止方法の地点に近づく（実機のGPSで、または `mosquitto_pub` で直接
   `{"type":"stop"}` を送って代用）と、モックのログで `stop` による停止を確認

## 注意

このモックは検証用のインメモリ実装です。永続化はせず、プロセスを終了すると状態は失われます。
