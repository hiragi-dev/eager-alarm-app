"use client";

import { useEffect, useRef, useState } from "react";
import Backdrop from "@mui/material/Backdrop";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import Chip from "@mui/material/Chip";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import CloudOffIcon from "@mui/icons-material/CloudOff";
import DeleteIcon from "@mui/icons-material/Delete";
import Alert from "@mui/material/Alert";
import { useMqtt } from "@/contexts/MqttProvider";
import { useNotify } from "@/contexts/NotificationProvider";
import { useAppReadiness } from "@/hooks/useAppReadiness";
import { blockReasonLabel } from "@/lib/appState";
import { formatDaysOfWeek, type Alarm, type DayOfWeek } from "@/lib/alarm";

const ADD_TIMEOUT_MS = 8000;
const ALL_DAYS: DayOfWeek[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DAY_LABELS: Record<DayOfWeek, string> = {
  Mon: "月", Tue: "火", Wed: "水", Thu: "木", Fri: "金", Sat: "土", Sun: "日"
};

function defaultTimeValue(): string {
  const d = new Date(Date.now() + 5 * 60 * 1000);
  d.setSeconds(0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

type DialogMode = { kind: "add" } | { kind: "edit"; alarm: Alarm };

export default function AlarmControl() {
  const { alarms, alarmsUpdatedAt, addAlarm, editAlarm, deleteAlarm } = useMqtt();
  const { alarmManagement } = useAppReadiness();
  const notify = useNotify();
  const ready = alarmManagement.kind === "ready";

  // Dialog state
  const [dialogMode, setDialogMode] = useState<DialogMode | null>(null);
  const [timeInput, setTimeInput] = useState(defaultTimeValue());
  const [selectedDays, setSelectedDays] = useState<DayOfWeek[]>(["Mon", "Tue", "Wed", "Thu", "Fri"]);

  // Saving indicator
  const [saving, setSaving] = useState(false);
  const saveRequestedAtRef = useRef<number | null>(null);

  // Close dialog when alarms list is updated after a save
  useEffect(() => {
    if (!saving) return;
    if (alarmsUpdatedAt != null && saveRequestedAtRef.current != null) {
      if (alarmsUpdatedAt >= saveRequestedAtRef.current) {
        setSaving(false);
        setDialogMode(null);
      }
    }
  }, [saving, alarmsUpdatedAt]);

  // Timeout fallback
  useEffect(() => {
    if (!saving) return;
    const timer = setTimeout(() => {
      setSaving(false);
      notify("error", "操作に時間がかかっています。反映されているか確認してください。");
      setDialogMode(null);
    }, ADD_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [saving, notify]);

  const openAddDialog = () => {
    setTimeInput(defaultTimeValue());
    setSelectedDays(["Mon", "Tue", "Wed", "Thu", "Fri"]);
    setDialogMode({ kind: "add" });
  };

  const openEditDialog = (alarm: Alarm) => {
    setTimeInput(alarm.time);
    setSelectedDays(alarm.days_of_week as DayOfWeek[]);
    setDialogMode({ kind: "edit", alarm });
  };

  const handleSave = () => {
    if (!timeInput) return;
    saveRequestedAtRef.current = Date.now();
    setSaving(true);

    if (dialogMode?.kind === "add") {
      addAlarm(timeInput, selectedDays, true);
    } else if (dialogMode?.kind === "edit") {
      editAlarm(dialogMode.alarm.id, timeInput, selectedDays, dialogMode.alarm.is_enabled);
    }
  };

  const handleDelete = () => {
    if (dialogMode?.kind !== "edit") return;
    deleteAlarm(dialogMode.alarm.id);
    setDialogMode(null);
  };

  const handleToggle = (alarm: Alarm) => {
    editAlarm(alarm.id, alarm.time, alarm.days_of_week as DayOfWeek[], !alarm.is_enabled);
  };

  const isOpen = dialogMode !== null;
  const isEdit = dialogMode?.kind === "edit";

  return (
    <Box sx={{ position: "relative", height: "100%", bgcolor: "#000000", color: "#ffffff", display: "flex", flexDirection: "column" }}>
      <Backdrop open={saving} sx={{ zIndex: (theme) => theme.zIndex.drawer + 2 }}>
        <Stack spacing={2} sx={{ alignItems: "center", color: "#fff" }}>
          <CircularProgress color="inherit" />
          <Typography>保存中…</Typography>
        </Stack>
      </Backdrop>

      {/* Header */}
      <Box sx={{ pt: 2, pb: 1, px: 2, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Typography variant="h4" sx={{ fontWeight: 700 }}>
          アラーム
        </Typography>
        <IconButton color="primary" onClick={openAddDialog} disabled={!ready} aria-label="アラームを追加">
          <AddIcon fontSize="large" />
        </IconButton>
      </Box>

      <Divider sx={{ borderColor: "rgba(255, 255, 255, 0.12)" }} />

      {/* Alarm List */}
      <Box sx={{ flex: 1, overflowY: "auto", px: 2 }}>
        {alarms.length === 0 ? (
          <Typography variant="body1" color="text.secondary" sx={{ mt: 4, textAlign: "center" }}>
            {alarmsUpdatedAt ? "アラームがありません" : "データを取得しています..."}
          </Typography>
        ) : (
          <List disablePadding>
            {alarms.map((alarm, index) => (
              <Box key={alarm.id}>
                <ListItem
                  disableGutters
                  sx={{ py: 1.5, cursor: "pointer", opacity: alarm.is_enabled ? 1 : 0.45 }}
                  onClick={() => openEditDialog(alarm)}
                >
                  <ListItemText
                    primary={
                      <Typography
                        variant="h2"
                        sx={{ fontWeight: 300, letterSpacing: "-0.02em", lineHeight: 1.1 }}
                      >
                        {alarm.time}
                      </Typography>
                    }
                    secondary={
                      <Typography variant="body2" sx={{ color: alarm.is_enabled ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.4)", mt: 0.5 }}>
                        {formatDaysOfWeek(alarm.days_of_week as DayOfWeek[])}
                      </Typography>
                    }
                  />
                  <Switch
                    checked={alarm.is_enabled}
                    onChange={(e) => {
                      e.stopPropagation();
                      handleToggle(alarm);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    disabled={!ready}
                    sx={{
                      "& .MuiSwitch-switchBase.Mui-checked": { color: "#34C759" },
                      "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": { backgroundColor: "#34C759" },
                    }}
                  />
                </ListItem>
                {index < alarms.length - 1 && (
                  <Divider sx={{ borderColor: "rgba(255, 255, 255, 0.12)" }} />
                )}
              </Box>
            ))}
          </List>
        )}
      </Box>

      {/* Add / Edit Dialog */}
      <Dialog
        open={isOpen}
        onClose={() => !saving && setDialogMode(null)}
        fullWidth
        maxWidth="xs"
        sx={{
          "& .MuiDialog-paper": {
            bgcolor: "#1c1c1e",
            color: "#fff",
            borderRadius: 4,
            backgroundImage: "none",
          }
        }}
      >
        <DialogTitle sx={{ textAlign: "center", fontWeight: 600, pb: 0 }}>
          {isEdit ? "アラームを編集" : "アラームを追加"}
        </DialogTitle>
        <DialogContent>
          {/* Time Picker */}
          <TextField
            type="time"
            value={timeInput}
            onChange={(e) => setTimeInput(e.target.value)}
            disabled={saving}
            fullWidth
            slotProps={{ htmlInput: { style: { fontSize: "2.5rem", fontWeight: 300, textAlign: "center", color: "#fff", letterSpacing: "0.05em" } } }}
            sx={{
              mt: 2,
              mb: 3,
              "& .MuiOutlinedInput-root": {
                "& fieldset": { border: "none" },
              },
            }}
          />

          {/* Weekday Selector */}
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1.5, textTransform: "uppercase", letterSpacing: "0.08em", fontSize: "0.7rem" }}>
            繰り返す曜日
          </Typography>
          <Box sx={{ display: "flex", justifyContent: "space-between", gap: 0.5 }}>
            {ALL_DAYS.map(day => {
              const selected = selectedDays.includes(day);
              const isSat = day === "Sat";
              const isSun = day === "Sun";
              const selectedColor = isSat ? "#0a84ff" : isSun ? "#ff453a" : "#30d158";
              return (
                <Chip
                  key={day}
                  label={DAY_LABELS[day]}
                  onClick={() => {
                    if (saving) return;
                    setSelectedDays(prev =>
                      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
                    );
                  }}
                  sx={{
                    width: 40,
                    height: 40,
                    borderRadius: "50%",
                    fontWeight: 700,
                    fontSize: "0.85rem",
                    cursor: "pointer",
                    bgcolor: selected ? selectedColor : "rgba(255,255,255,0.08)",
                    color: selected ? "#fff" : isSat ? "#0a84ff" : isSun ? "#ff453a" : "rgba(255,255,255,0.55)",
                    transition: "background-color 0.15s ease, transform 0.1s ease",
                    "&:hover": {
                      bgcolor: selected ? selectedColor : "rgba(255,255,255,0.14)",
                      transform: "scale(1.08)",
                    },
                    "&:active": { transform: "scale(0.95)" },
                    "& .MuiChip-label": { px: 0 },
                    opacity: saving ? 0.5 : 1,
                  }}
                />
              );
            })}
          </Box>
        </DialogContent>
        <DialogActions sx={{ flexDirection: "column", p: 2, gap: 1 }}>
          <Stack direction="row" spacing={1} sx={{ width: "100%" }}>
            <Button
              onClick={() => !saving && setDialogMode(null)}
              fullWidth
              disabled={saving}
              sx={{ color: "#ff453a", borderRadius: 2, py: 1.2 }}
            >
              キャンセル
            </Button>
            <Button
              onClick={handleSave}
              variant="contained"
              fullWidth
              disabled={saving || !timeInput}
              sx={{ borderRadius: 2, py: 1.2 }}
            >
              保存
            </Button>
          </Stack>
          {isEdit && (
            <Button
              onClick={handleDelete}
              startIcon={<DeleteIcon />}
              fullWidth
              disabled={saving}
              sx={{ color: "#ff453a", borderRadius: 2, py: 1 }}
            >
              アラームを削除
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* Connection Error Overlay */}
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
          <Box
            sx={{
              maxWidth: 400,
              width: "100%",
              bgcolor: "rgba(30, 30, 30, 0.8)",
              backdropFilter: "blur(20px)",
              boxShadow: "0 16px 40px rgba(0, 0, 0, 0.5)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              borderRadius: 3,
              textAlign: "center",
              py: 4,
              px: 2,
            }}
          >
            <Box
              sx={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                p: 2,
                mb: 2,
                borderRadius: "50%",
                bgcolor: "rgba(244, 67, 54, 0.1)",
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
          </Box>
        </Box>
      )}
    </Box>
  );
}
