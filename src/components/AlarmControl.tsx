"use client";

import { useEffect, useRef, useState } from "react";
import Alert from "@mui/material/Alert";
import Backdrop from "@mui/material/Backdrop";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CircularProgress from "@mui/material/CircularProgress";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import DeleteIcon from "@mui/icons-material/Delete";
import RefreshIcon from "@mui/icons-material/Refresh";
import CloudOffIcon from "@mui/icons-material/CloudOff";
import { useMqtt } from "@/contexts/MqttProvider";
import { useNotify } from "@/contexts/NotificationProvider";
import { useAppReadiness } from "@/hooks/useAppReadiness";
import { blockReasonLabel } from "@/lib/appState";
import { datetimeLocalToWakeupTime, formatWakeupTime } from "@/lib/alarm";

/** これを超えて list 応答が来なければローディングを解除する(edge無応答等でUIが固まるのを防ぐ) */
const ADD_TIMEOUT_MS = 8000;

/** datetime-local の初期値（現在時刻の5分後、秒は切り捨て） */
function defaultDatetimeLocal(): string {
  const d = new Date(Date.now() + 5 * 60 * 1000);
  d.setSeconds(0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function AlarmControl() {
  const { alarms, alarmsUpdatedAt, requestAlarms, addAlarm, deleteAlarm } = useMqtt();
  const { alarmManagement } = useAppReadiness();
  const notify = useNotify();
  const [wakeupInput, setWakeupInput] = useState(defaultDatetimeLocal());
  const ready = alarmManagement.kind === "ready";

  // add送信後、list応答(alarmsUpdatedAtの更新)が返るまで画面をブロックする。
  // 応答until待たずに連打すると、反映の遅延によって同じアラームを何度も追加してしまうため。
  const [adding, setAdding] = useState(false);
  const addRequestedAtRef = useRef<number | null>(null);

  useEffect(() => {
    if (!adding) return;
    if (alarmsUpdatedAt != null && addRequestedAtRef.current != null) {
      if (alarmsUpdatedAt >= addRequestedAtRef.current) setAdding(false);
    }
  }, [adding, alarmsUpdatedAt]);

  useEffect(() => {
    if (!adding) return;
    const timer = setTimeout(() => {
      setAdding(false);
      notify("error", "アラーム一覧の更新に時間がかかっています。反映されているか確認してください。");
    }, ADD_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [adding, notify]);

  const handleAdd = () => {
    if (!wakeupInput) return;
    addRequestedAtRef.current = Date.now();
    setAdding(true);
    addAlarm(datetimeLocalToWakeupTime(wakeupInput));
  };

  return (
    <Box sx={{ position: "relative", height: "100%" }}>
      <Stack spacing={3}>
      <Backdrop open={adding} sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}>
        <Stack spacing={2} sx={{ alignItems: "center" }}>
          <CircularProgress color="inherit" />
          <Typography>アラームを追加しています…</Typography>
        </Stack>
      </Backdrop>


      <Card variant="outlined">
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2 }}>
            アラームを追加
          </Typography>
          <Stack direction="row" spacing={2} sx={{ alignItems: "flex-start" }}>
            <TextField
              label="起床時刻"
              type="datetime-local"
              value={wakeupInput}
              onChange={(e) => setWakeupInput(e.target.value)}
              disabled={!ready || adding}
              size="small"
              slotProps={{ inputLabel: { shrink: true } }}
              fullWidth
            />
            <Button
              variant="contained"
              onClick={handleAdd}
              disabled={!ready || adding || !wakeupInput}
              sx={{ flexShrink: 0 }}
            >
              追加
            </Button>
          </Stack>
        </CardContent>
      </Card>

      <Card variant="outlined">
        <CardContent>
          <Stack
            direction="row"
            sx={{ alignItems: "center", justifyContent: "space-between", mb: 1 }}
          >
            <Typography variant="h6">アラーム一覧</Typography>
            <IconButton onClick={requestAlarms} disabled={!ready} size="small" aria-label="更新">
              <RefreshIcon fontSize="small" />
            </IconButton>
          </Stack>
          <Divider sx={{ mb: 1 }} />

          {alarms.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              {alarmsUpdatedAt ? "登録されているアラームはありません" : "まだ取得していません"}
            </Typography>
          ) : (
            <List dense disablePadding>
              {alarms.map((alarm) => (
                <ListItem
                  key={alarm.id}
                  disableGutters
                  secondaryAction={
                    <IconButton
                      edge="end"
                      aria-label="削除"
                      onClick={() => deleteAlarm(alarm.id)}
                      disabled={!ready}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  }
                >
                  <ListItemText
                    primary={formatWakeupTime(alarm.wakeup_time)}
                    secondary={alarm.id}
                    slotProps={{
                      secondary: {
                        sx: { fontFamily: "var(--font-geist-mono), monospace", fontSize: 11 },
                      },
                    }}
                  />
                </ListItem>
              ))}
            </List>
          )}

          {alarmsUpdatedAt && (
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
              最終更新: {new Date(alarmsUpdatedAt).toLocaleTimeString("ja-JP", { hour12: false })}
            </Typography>
          )}
        </CardContent>
      </Card>
    </Stack>

      {alarmManagement.kind === "blocked" && (
        <Box
          sx={{
            position: "absolute",
            inset: -16,
            zIndex: 10,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            bgcolor: "rgba(0, 0, 0, 0.5)",
            backdropFilter: "blur(6px)",
            borderRadius: 4,
            p: 3,
          }}
        >
          <Card
            sx={{
              maxWidth: 400,
              width: "100%",
              bgcolor: "rgba(30, 30, 30, 0.8)",
              backdropFilter: "blur(20px)",
              boxShadow: "0 16px 40px rgba(0, 0, 0, 0.5)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              borderRadius: 3,
            }}
          >
            <CardContent sx={{ textAlign: "center", py: 4 }}>
              <Box
                sx={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  p: 2,
                  mb: 2,
                  borderRadius: "50%",
                  bgcolor: "rgba(244, 67, 54, 0.1)", // Light red background
                  color: "error.main",
                }}
              >
                <CloudOffIcon sx={{ fontSize: 40 }} />
              </Box>
              <Typography variant="h6" color="error" gutterBottom sx={{ fontWeight: "bold" }}>
                未接続・エラー
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                アラームを操作するには、デバイスとの接続が必要です。以下の問題を確認してください。
              </Typography>
              <Stack spacing={1.5} sx={{ textAlign: "left" }}>
                {alarmManagement.reasons.map((reason, i) => (
                  <Alert severity="error" key={i} sx={{ borderRadius: 2 }}>
                    {blockReasonLabel(reason)}
                  </Alert>
                ))}
              </Stack>
            </CardContent>
          </Card>
        </Box>
      )}
    </Box>
  );
}
