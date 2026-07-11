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
[10:00:05] ✅ add id=3fa8... wakeup_time=2026-07-11T10:00:10+09:00
[10:00:10] 🔔🔔🔔 ALARM RINGING id=3fa8... wakeup_time=2026-07-11T10:00:10+09:00
[10:00:12] 🔔 鳴動中... id=3fa8...
[10:00:13] 😴 pause: 5000ms 停止 (muted_until=10:00:18)
[10:00:18] 🔔 鳴動中... id=3fa8...
[10:00:19] 🛑 stop: 鳴動中のアラーム id=3fa8... を完全停止しました
```

## 実装している状態遷移

- スケジュール済みのアラームは `wakeup_time` の昇順で保持し、時刻が来ると「鳴動中」に遷移する
  （鳴動を開始したアラームはスケジュールから取り除かれる＝以後 `list` には出てこない。
  現行の `eager-alarm-edge` の `queue.pop()` と同じ挙動）
- `pause`: `duration_ms` 後まで鳴動（への遷移・継続）を抑制する `muted_until` を**上書き**で延長する
  （積算しない。歩行検知中にアプリが数秒おきに再送する前提のため）
- `stop`: 鳴動中のアラームを完全に停止し、`muted_until` もクリアする（自動再開なし）
- `delete` が鳴動中のアラームに対して送られた場合も、その場で鳴動を停止する
- `status`: 受信したら即座に `status` トピックへ `{"online":true}` を応答する。
  アプリはブローカー接続中5秒おきにこのコマンドを送っており、応答があれば「オンライン」、
  13秒間応答が無ければ「オフライン」と判定する（このモックは常に即応するので、
  接続直後しばらくすると常時オンライン表示になるはず）

## 動作確認の例

1. `npm run mock:edge` を起動
2. アプリの「MQTT設定」タブで接続 → 「アラーム」タブで数秒後に鳴る `add` を送信
3. モックのログで `ALARM RINGING` を確認
4. アプリの「アラームを止める」タブでボタンを押し、実機/PC等を振って歩行を検知させる →
   モックのログに `pause` 受信と静音化が出ることを確認
5. `stop` を直接 `mosquitto_pub` などで送るか、位置情報の到達条件を満たして自動送信させ、
   モックのログで `stop` による完全停止を確認

## 注意

このモックは検証用のインメモリ実装です。永続化はせず、プロセスを終了すると状態は失われます。
