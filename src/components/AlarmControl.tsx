"use client";

import { useState } from "react";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
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
import { useMqtt } from "@/contexts/MqttProvider";
import { useAppReadiness } from "@/hooks/useAppReadiness";
import { blockReasonLabel } from "@/lib/appState";
import { datetimeLocalToWakeupTime, formatWakeupTime } from "@/lib/alarm";

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
  const [wakeupInput, setWakeupInput] = useState(defaultDatetimeLocal());
  const ready = alarmManagement.kind === "ready";

  const handleAdd = () => {
    if (!wakeupInput) return;
    addAlarm(datetimeLocalToWakeupTime(wakeupInput));
  };

  return (
    <Stack spacing={3}>
      {alarmManagement.kind === "blocked" && (
        <Alert severity="warning">
          {alarmManagement.reasons.map(blockReasonLabel).join(" / ")}
        </Alert>
      )}

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
              disabled={!ready}
              size="small"
              slotProps={{ inputLabel: { shrink: true } }}
              fullWidth
            />
            <Button
              variant="contained"
              onClick={handleAdd}
              disabled={!ready || !wakeupInput}
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
  );
}
