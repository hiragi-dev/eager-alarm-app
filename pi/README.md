# Raspberry Pi 側 MQTT購読デモ

`alarm-demo/<DEVICE_ID>/command` を購読し、アプリから送られた `on` / `off`
コマンドを受け取って表示（＋任意でGPIO制御）します。受信後は
`alarm-demo/<DEVICE_ID>/status` に ack を返します。

接続先は **自分で用意した HiveMQ Cloud ブローカー**（TLS 認証付き）を想定しています。

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

## ブローカー接続情報の設定

`.env.example` をコピーして `.env` を作り、HiveMQ Cloud の情報を入力します。

```bash
cp .env.example .env
# .env を編集: MQTT_BROKER / MQTT_USERNAME / MQTT_PASSWORD / DEVICE_ID
```

- `MQTT_BROKER` はホスト名のみ（例: `xxxxxxxx.s1.eu.hivemq.cloud`）
- `MQTT_PORT` は `8883`（TLS。8883 を指定すると自動で TLS 有効化）
- `DEVICE_ID` はアプリ画面に表示されるデバイスIDと一致させる

## 実行

```bash
set -a; . ./.env; set +a   # .env を環境変数に読み込む
python3 subscriber.py
```

`.env` を使わず、その場で指定することもできます。

```bash
MQTT_BROKER=xxxxxxxx.s1.eu.hivemq.cloud MQTT_USERNAME=user MQTT_PASSWORD=pass \
  DEVICE_ID=demo-xxxxxxxx python3 subscriber.py
```

> `MQTT_BROKER` が未設定の場合はエラーで停止します（公開ブローカーへは自動接続しません）。

## 動作確認

1. このスクリプトを起動する
2. ブラウザでアプリ（`npm run dev` → http://localhost:3000）を開き、同じ HiveMQ Cloud の
   WebSocket エンドポイント（例: `wss://xxxxxxxx.s1.eu.hivemq.cloud:8884/mqtt`）・認証情報・
   同じデバイスIDで「接続」する
3. アプリの **ON / OFF** ボタンを押す
4. このスクリプトの標準出力に `受信 [...]: {"command":"on",...}` と表示され、
   アプリ側のログに `← .../status: {"event":"ack",...}` が返れば往復成功です

## 注意

デバイスIDは推測されにくい一意な値にし、本番ではトピックごとの ACL でデバイスを分離してください。
`.env`（認証情報）は Git 管理対象外です（コミットしないこと）。
