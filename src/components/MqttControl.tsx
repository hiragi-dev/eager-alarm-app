"use client";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Divider from "@mui/material/Divider";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import PowerSettingsNewIcon from "@mui/icons-material/PowerSettingsNew";
import { useMqtt, type EdgeDeviceStatus, type MqttStatus } from "@/contexts/MqttProvider";

const statusMeta: Record<
  MqttStatus,
  { label: string; color: "default" | "warning" | "success" | "error" }
> = {
  disconnected: { label: "未接続", color: "default" },
  connecting: { label: "接続中…", color: "warning" },
  connected: { label: "接続済み", color: "success" },
  error: { label: "エラー", color: "error" },
};

const edgeStatusMeta: Record<
  EdgeDeviceStatus,
  { label: string; color: "default" | "warning" | "success" | "error" }
> = {
  unknown: { label: "edge: 確認中", color: "default" },
  online: { label: "edge: オンライン", color: "success" },
  offline: { label: "edge: オフライン", color: "error" },
};

export default function MqttControl() {
  const {
    settings,
    updateSetting,
    status,
    edgeStatus,
    connect,
    disconnect,
    log,
    sendPowerCommand,
    envSeeded,
  } = useMqtt();

  const meta = statusMeta[status];
  const edgeMeta = edgeStatusMeta[edgeStatus];
  const connected = status === "connected";
  const editable = status === "disconnected";

  return (
    <Stack spacing={3}>
      <Card variant="outlined">
        <CardContent>
          <Stack
            direction="row"
            spacing={1}
            sx={{
              alignItems: "center",
              justifyContent: "space-between",
              mb: 2,
            }}
          >
            <Typography variant="h6">接続設定</Typography>
            <Stack direction="row" spacing={1}>
              <Chip label={meta.label} color={meta.color} size="small" />
              <Chip label={edgeMeta.label} color={edgeMeta.color} size="small" />
            </Stack>
          </Stack>

          {envSeeded && (
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: "block", mb: 2 }}
            >
              開発モード: .env.local の NEXT_PUBLIC_MQTT_*
              を初期値として読み込みました
            </Typography>
          )}

          <Stack spacing={2}>
            <TextField
              label="ブローカー URL (WebSocket)"
              value={settings.brokerUrl}
              onChange={(e) => updateSetting("brokerUrl", e.target.value)}
              disabled={!editable}
              required
              placeholder="wss://xxxxxxxx.s1.eu.hivemq.cloud:8884/mqtt"
              helperText="HiveMQ Cloud の WebSocket エンドポイント（TLS: 8884, パス /mqtt）"
              size="small"
              fullWidth
            />
            <TextField
              label="デバイスID"
              value={settings.deviceId}
              onChange={(e) => updateSetting("deviceId", e.target.value)}
              disabled={!editable}
              helperText="Pi側の DEVICE_ID と一致させてください"
              size="small"
              fullWidth
            />
            <Stack direction="row" spacing={2}>
              <TextField
                label="ユーザー名"
                value={settings.username}
                onChange={(e) => updateSetting("username", e.target.value)}
                disabled={!editable}
                autoComplete="off"
                size="small"
                fullWidth
              />
              <TextField
                label="パスワード"
                type="password"
                value={settings.password}
                onChange={(e) => updateSetting("password", e.target.value)}
                disabled={!editable}
                autoComplete="new-password"
                size="small"
                fullWidth
              />
            </Stack>

            <Stack direction="row" spacing={2}>
              <Button
                variant="contained"
                onClick={connect}
                startIcon={
                  status === "connecting" ? (
                    <CircularProgress size={16} color="inherit" />
                  ) : undefined
                }
                disabled={
                  status === "connecting" ||
                  connected ||
                  !settings.deviceId ||
                  !settings.brokerUrl
                }
              >
                {status === "connecting" ? "接続中…" : "接続"}
              </Button>
              <Button
                variant="outlined"
                onClick={disconnect}
                disabled={status === "disconnected"}
              >
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
              onClick={() => sendPowerCommand("on")}
              disabled={!connected}
              fullWidth
            >
              ON
            </Button>
            <Button
              variant="contained"
              color="error"
              startIcon={<PowerSettingsNewIcon />}
              onClick={() => sendPowerCommand("off")}
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
