# Raspberry Pi 側 MQTT購読デモ

`alarm-demo/<DEVICE_ID>/command` を購読し、アプリから送られた `on` / `off`
コマンドを受け取って表示（＋任意でGPIO制御）します。受信後は
`alarm-demo/<DEVICE_ID>/status` に ack を返します。

## セットアップ

```bash
cd pi
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Raspberry Pi 実機でGPIOを使う場合は `RPi.GPIO` も入れてください（Pi OS には標準で入っていることが多いです）。

```bash
pip install RPi.GPIO
```

## 実行

アプリ画面に表示されている **デバイスID** を `DEVICE_ID` に指定します。

```bash
DEVICE_ID=demo-xxxxxxxx python3 subscriber.py
# もしくは
python3 subscriber.py demo-xxxxxxxx
```

デフォルトではアカウント不要の公開ブローカー `broker.hivemq.com:1883` に接続します。

## 動作確認

1. このスクリプトを起動する
2. ブラウザでアプリ（`npm run dev` → http://localhost:3000）を開き、同じデバイスIDで「接続」する
3. アプリの **ON / OFF** ボタンを押す
4. このスクリプトの標準出力に `受信 [...]: {"command":"on",...}` と表示され、
   アプリ側のログに `← .../status: {"event":"ack",...}` が返れば往復成功です

## 本番ブローカー(HiveMQ Cloud等)に切り替える

環境変数で上書きできます（TLSは 8883 を指定すると自動で有効化）。

```bash
export MQTT_BROKER=xxxxxxxx.s1.eu.hivemq.cloud
export MQTT_PORT=8883
export MQTT_USERNAME=your-user
export MQTT_PASSWORD=your-pass
DEVICE_ID=demo-xxxxxxxx python3 subscriber.py
```

アプリ側は WebSocket エンドポイント（例: `wss://xxxxxxxx.s1.eu.hivemq.cloud:8884/mqtt`）と
同じ認証情報を接続設定に入力してください。

## 注意

公開ブローカー `broker.hivemq.com` は**誰でも購読・publishできるテスト用**です。
デバイスIDは推測されにくい一意な値にし、本番では認証付き＋トピックACLのブローカーを使ってください。
