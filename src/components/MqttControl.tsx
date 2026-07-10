"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { IClientOptions, MqttClient } from "mqtt";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import PowerSettingsNewIcon from "@mui/icons-material/PowerSettingsNew";
import {
  commandTopic,
  defaultSettings,
  generateDeviceId,
  type MqttSettings,
  statusTopic,
  STORAGE_KEY,
} from "@/lib/mqtt";

type Status = "disconnected" | "connecting" | "connected" | "error";

type LogEntry = { time: string; text: string };

const MAX_LOG = 30;

const statusMeta: Record<Status, { label: string; color: "default" | "warning" | "success" | "error" }> = {
  disconnected: { label: "未接続", color: "default" },
  connecting: { label: "接続中…", color: "warning" },
  connected: { label: "接続済み", color: "success" },
  error: { label: "エラー", color: "error" },
};

export default function MqttControl() {
  const [settings, setSettings] = useState<MqttSettings>(defaultSettings);
  const [status, setStatus] = useState<Status>("disconnected");
  const [log, setLog] = useState<LogEntry[]>([]);
  const clientRef = useRef<MqttClient | null>(null);

  const addLog = useCallback((text: string) => {
    const time = new Date().toLocaleTimeString("ja-JP", { hour12: false });
    setLog((prev) => [{ time, text }, ...prev].slice(0, MAX_LOG));
  }, []);

  // 初回マウント時に localStorage から設定を復元。無ければ一意なデバイスIDを生成して保存。
  useEffect(() => {
    let next: MqttSettings;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        next = { ...defaultSettings, ...JSON.parse(raw) };
      } else {
        next = { ...defaultSettings, deviceId: generateDeviceId() };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      }
    } catch {
      next = { ...defaultSettings, deviceId: generateDeviceId() };
    }
    // localStorage からの初期復元（マウント時一度きり）
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSettings(next);
  }, []);

  // アンマウント時に接続を確実に閉じる
  useEffect(() => {
    return () => {
      clientRef.current?.end(true);
      clientRef.current = null;
    };
  }, []);

  const updateSetting = (key: keyof MqttSettings, value: string) => {
    setSettings((prev) => {
      const next = { ...prev, [key]: value };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore storage errors
      }
      return next;
    });
  };

  const connect = useCallback(async () => {
    if (clientRef.current) return;
    setStatus("connecting");
    addLog(`${settings.brokerUrl} へ接続します…`);

    const mqtt = (await import("mqtt")).default;
    const options: IClientOptions = {
      clientId: `webapp-${Math.random().toString(16).slice(2, 10)}`,
      username: settings.username || undefined,
      password: settings.password || undefined,
      clean: true,
      connectTimeout: 8000,
      reconnectPeriod: 0,
    };

    const client = mqtt.connect(settings.brokerUrl, options);
    clientRef.current = client;
    const sTopic = statusTopic(settings.deviceId);

    client.on("connect", () => {
      setStatus("connected");
      addLog("接続しました");
      client.subscribe(sTopic, (err) => {
        if (err) addLog(`購読失敗: ${err.message}`);
        else addLog(`購読開始: ${sTopic}`);
      });
    });

    client.on("message", (topic, payload) => {
      addLog(`← ${topic}: ${payload.toString()}`);
    });

    client.on("error", (err) => {
      setStatus("error");
      addLog(`エラー: ${err.message}`);
    });

    client.on("close", () => {
      setStatus((s) => (s === "error" ? s : "disconnected"));
    });
  }, [addLog, settings]);

  const disconnect = useCallback(() => {
    clientRef.current?.end(true);
    clientRef.current = null;
    setStatus("disconnected");
    addLog("切断しました");
  }, [addLog]);

  const publish = useCallback(
    (command: "on" | "off") => {
      const client = clientRef.current;
      if (!client || status !== "connected") return;
      const topic = commandTopic(settings.deviceId);
      const payload = JSON.stringify({ command, ts: Date.now() });
      client.publish(topic, payload, { qos: 0 }, (err) => {
        if (err) addLog(`送信失敗: ${err.message}`);
        else addLog(`→ ${topic}: ${payload}`);
      });
    },
    [addLog, settings.deviceId, status],
  );

  const meta = statusMeta[status];
  const connected = status === "connected";

  return (
    <Stack spacing={3}>
      <Card variant="outlined">
        <CardContent>
          <Stack
            direction="row"
            spacing={1}
            sx={{ alignItems: "center", justifyContent: "space-between", mb: 2 }}
          >
            <Typography variant="h6">接続設定</Typography>
            <Chip label={meta.label} color={meta.color} size="small" />
          </Stack>

          <Stack spacing={2}>
            <TextField
              label="ブローカー URL (WebSocket)"
              value={settings.brokerUrl}
              onChange={(e) => updateSetting("brokerUrl", e.target.value)}
              disabled={status !== "disconnected"}
              size="small"
              fullWidth
            />
            <TextField
              label="デバイスID"
              value={settings.deviceId}
              onChange={(e) => updateSetting("deviceId", e.target.value)}
              disabled={status !== "disconnected"}
              helperText="Pi側の DEVICE_ID と一致させてください"
              size="small"
              fullWidth
            />
            <Stack direction="row" spacing={2}>
              <TextField
                label="ユーザー名 (任意)"
                value={settings.username}
                onChange={(e) => updateSetting("username", e.target.value)}
                disabled={status !== "disconnected"}
                size="small"
                fullWidth
              />
              <TextField
                label="パスワード (任意)"
                type="password"
                value={settings.password}
                onChange={(e) => updateSetting("password", e.target.value)}
                disabled={status !== "disconnected"}
                size="small"
                fullWidth
              />
            </Stack>

            <Stack direction="row" spacing={2}>
              <Button
                variant="contained"
                onClick={connect}
                disabled={status === "connecting" || connected || !settings.deviceId}
              >
                接続
              </Button>
              <Button variant="outlined" onClick={disconnect} disabled={status === "disconnected"}>
                切断
              </Button>
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      <Card variant="outlined">
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2 }}>
            コマンド送信
          </Typography>
          <Stack direction="row" spacing={2}>
            <Button
              variant="contained"
              color="success"
              startIcon={<PowerSettingsNewIcon />}
              onClick={() => publish("on")}
              disabled={!connected}
              fullWidth
            >
              ON
            </Button>
            <Button
              variant="contained"
              color="error"
              startIcon={<PowerSettingsNewIcon />}
              onClick={() => publish("off")}
              disabled={!connected}
              fullWidth
            >
              OFF
            </Button>
          </Stack>
        </CardContent>
      </Card>

      <Card variant="outlined">
        <CardContent>
          <Typography variant="h6" sx={{ mb: 1 }}>
            ログ
          </Typography>
          <Divider sx={{ mb: 1 }} />
          <Box
            component="pre"
            sx={{
              m: 0,
              maxHeight: 260,
              overflow: "auto",
              fontFamily: "var(--font-geist-mono), monospace",
              fontSize: 12,
              whiteSpace: "pre-wrap",
              wordBreak: "break-all",
            }}
          >
            {log.length === 0
              ? "（まだログはありません）"
              : log.map((e) => `${e.time}  ${e.text}`).join("\n")}
          </Box>
        </CardContent>
      </Card>
    </Stack>
  );
}
