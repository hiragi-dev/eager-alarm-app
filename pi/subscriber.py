#!/usr/bin/env python3
"""Raspberry Pi 向け MQTT コマンド購読デモ。

`alarm-demo/<DEVICE_ID>/command` を購読し、受信したコマンド(on/off)を表示する。
受信後は `alarm-demo/<DEVICE_ID>/status` に ack を publish して往復を確認できる。
RPi.GPIO が利用可能なら指定ピンをオン/オフする(ラップトップ上では自動的にスキップ)。

環境変数:
  MQTT_BROKER   ブローカーのホスト名 (default: broker.hivemq.com)
  MQTT_PORT     ポート (default: 1883。TLSなら 8883)
  MQTT_USERNAME 認証ユーザー名 (任意)
  MQTT_PASSWORD 認証パスワード (任意)
  DEVICE_ID     デバイスID (アプリ側と一致させる)
  GPIO_PIN      制御するBCMピン番号 (default: 17)

使い方:
  DEVICE_ID=demo-xxxx python3 subscriber.py
  # または引数で: python3 subscriber.py demo-xxxx
"""
import json
import os
import sys

import paho.mqtt.client as mqtt

BROKER = os.environ.get("MQTT_BROKER", "broker.hivemq.com")
PORT = int(os.environ.get("MQTT_PORT", "1883"))
USERNAME = os.environ.get("MQTT_USERNAME", "")
PASSWORD = os.environ.get("MQTT_PASSWORD", "")
DEVICE_ID = os.environ.get("DEVICE_ID") or (sys.argv[1] if len(sys.argv) > 1 else "demo-device")

TOPIC_PREFIX = "alarm-demo"
COMMAND_TOPIC = f"{TOPIC_PREFIX}/{DEVICE_ID}/command"
STATUS_TOPIC = f"{TOPIC_PREFIX}/{DEVICE_ID}/status"

# --- GPIO(任意) -------------------------------------------------------------
try:
    import RPi.GPIO as GPIO  # type: ignore

    GPIO_PIN = int(os.environ.get("GPIO_PIN", "17"))
    GPIO.setmode(GPIO.BCM)
    GPIO.setup(GPIO_PIN, GPIO.OUT)
    HAS_GPIO = True
except Exception:
    GPIO = None  # type: ignore
    GPIO_PIN = None
    HAS_GPIO = False


def set_output(state: bool) -> None:
    """GPIO が使える環境なら出力を切り替える。"""
    if HAS_GPIO and GPIO is not None and GPIO_PIN is not None:
        GPIO.output(GPIO_PIN, GPIO.HIGH if state else GPIO.LOW)
    print(f"  -> 出力を {'ON' if state else 'OFF'} にしました"
          + ("" if HAS_GPIO else " (GPIO未使用: 表示のみ)"))


# --- MQTT コールバック ------------------------------------------------------
def on_connect(client, userdata, flags, reason_code, properties=None):
    print(f"接続しました (rc={reason_code})。購読開始: {COMMAND_TOPIC}")
    client.subscribe(COMMAND_TOPIC)
    client.publish(STATUS_TOPIC, json.dumps({"event": "online", "device": DEVICE_ID}))


def on_message(client, userdata, msg):
    payload = msg.payload.decode("utf-8", errors="replace")
    print(f"受信 [{msg.topic}]: {payload}")

    command = payload
    try:
        command = json.loads(payload).get("command", payload)
    except json.JSONDecodeError:
        pass

    if command == "on":
        set_output(True)
    elif command == "off":
        set_output(False)
    else:
        print(f"  -> 未知のコマンド: {command}")

    client.publish(
        STATUS_TOPIC,
        json.dumps({"event": "ack", "device": DEVICE_ID, "command": command}),
    )


def main() -> None:
    client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)
    if USERNAME:
        client.username_pw_set(USERNAME, PASSWORD)
    if PORT == 8883:
        client.tls_set()  # TLS(HiveMQ Cloud などの認証付きブローカー用)

    client.on_connect = on_connect
    client.on_message = on_message

    print(f"{BROKER}:{PORT} に device '{DEVICE_ID}' として接続します…")
    client.connect(BROKER, PORT, keepalive=60)
    try:
        client.loop_forever()
    except KeyboardInterrupt:
        print("\n終了します…")
    finally:
        if HAS_GPIO and GPIO is not None:
            GPIO.cleanup()


if __name__ == "__main__":
    main()
