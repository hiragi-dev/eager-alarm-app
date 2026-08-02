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
import FormControl from "@mui/material/FormControl";
import FormLabel from "@mui/material/FormLabel";
import IconButton from "@mui/material/IconButton";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import AlarmOffIcon from "@mui/icons-material/AlarmOff";
import CloudOffIcon from "@mui/icons-material/CloudOff";
import DeleteIcon from "@mui/icons-material/Delete";
import Alert from "@mui/material/Alert";
import { useMqtt } from "@/contexts/MqttProvider";
import { useNotify } from "@/contexts/NotificationProvider";
import { useStopMethods } from "@/contexts/StopMethodProvider";
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

/** edge応答待ちの操作種別。ポップアップの文言出し分けに使う */
type SavingOp = "add" | "edit" | "delete";

export default function AlarmControl() {
  const { alarms, alarmsUpdatedAt, ringingStatus, addAlarm, editAlarm, deleteAlarm } = useMqtt();
  const { alarmManagement, broker } = useAppReadiness();
  const { stopMethods } = useStopMethods();
  const notify = useNotify();
  const ready = alarmManagement.kind === "ready";
  const ringingIds = ringingStatus?.ringing_ids ?? [];

  // Dialog state
  const [dialogMode, setDialogMode] = useState<DialogMode | null>(null);
  const [timeInput, setTimeInput] = useState(defaultTimeValue());
  const [selectedDays, setSelectedDays] = useState<DayOfWeek[]>(["Mon", "Tue", "Wed", "Thu", "Fri"]);
  const [selectedStopMethodId, setSelectedStopMethodId] = useState("");

  // edge応答(list返信)待ちの操作。追加/編集/削除いずれもポップアップでブロックする
  const [savingOp, setSavingOp] = useState<SavingOp | null>(null);
  const saving = savingOp !== null;
  const saveRequestedAtRef = useRef<number | null>(null);

  // 有効/無効トグルのedge応答待ち(アラームID → リクエスト時刻)。
  // トグルはダイアログを介さないため、対象行のスイッチをスピナーに置き換えて応答待ちを伝える
  const [pendingToggles, setPendingToggles] = useState<Record<string, number>>({});

  // Close dialog when alarms list is updated after a save
  useEffect(() => {
    if (!saving) return;
    if (alarmsUpdatedAt != null && saveRequestedAtRef.current != null) {
      if (alarmsUpdatedAt >= saveRequestedAtRef.current) {
        setSavingOp(null);
        setDialogMode(null);
      }
    }
  }, [saving, alarmsUpdatedAt]);

  // Timeout fallback
  useEffect(() => {
    if (!saving) return;
    const timer = setTimeout(() => {
      setSavingOp(null);
      notify("error", "操作に時間がかかっています。反映されているか確認してください。");
      setDialogMode(null);
    }, ADD_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [saving, notify]);

  // トグルのedge応答(list返信)を確認できたら、該当アラームのスピナーを解除する
  useEffect(() => {
    if (alarmsUpdatedAt == null) return;
    // list受信(=MqttProviderの状態変化)に同期した解除
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPendingToggles((prev) => {
      const entries = Object.entries(prev).filter(([, requestedAt]) => requestedAt > alarmsUpdatedAt);
      return entries.length === Object.keys(prev).length ? prev : Object.fromEntries(entries);
    });
  }, [alarmsUpdatedAt]);

  // トグルの応答が一定時間確認できなければ、スピナーを解除して通知する
  useEffect(() => {
    if (Object.keys(pendingToggles).length === 0) return;
    const timer = setTimeout(() => {
      setPendingToggles({});
      notify("error", "切り替えの反映を確認できませんでした。一覧を確認してください。");
    }, ADD_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [pendingToggles, notify]);

  const openAddDialog = () => {
    setTimeInput(defaultTimeValue());
    setSelectedDays(["Mon", "Tue", "Wed", "Thu", "Fri"]);
    setSelectedStopMethodId("");
    setDialogMode({ kind: "add" });
  };

  const openEditDialog = (alarm: Alarm) => {
    setTimeInput(alarm.time);
    setSelectedDays(alarm.days_of_week as DayOfWeek[]);
    setSelectedStopMethodId(alarm.stop_method_id ?? "");
    setDialogMode({ kind: "edit", alarm });
  };

  const handleSave = () => {
    if (!timeInput || !selectedStopMethodId) return;
    // 削除と同じく、鳴動中のアラームは内容を書き換えさせない
    if (dialogMode?.kind === "edit" && ringingIds.includes(dialogMode.alarm.id)) return;
    saveRequestedAtRef.current = Date.now();

    if (dialogMode?.kind === "add") {
      setSavingOp("add");
      addAlarm(timeInput, selectedDays, true, selectedStopMethodId);
    } else if (dialogMode?.kind === "edit") {
      setSavingOp("edit");
      editAlarm(
        dialogMode.alarm.id,
        timeInput,
        selectedDays,
        dialogMode.alarm.is_enabled,
        selectedStopMethodId,
      );
    }
  };

  const handleDelete = () => {
    if (dialogMode?.kind !== "edit") return;
    // 鳴動中のアラームを消すと停止操作の対象を見失うため、削除は停止後に限定する
    if (ringingIds.includes(dialogMode.alarm.id)) return;
    // 追加/編集と同じく、edgeのlist返信で削除の反映を確認できるまでダイアログを保持する
    saveRequestedAtRef.current = Date.now();
    setSavingOp("delete");
    deleteAlarm(dialogMode.alarm.id);
  };

  const handleToggle = (alarm: Alarm) => {
    if (!alarm.stop_method_id) return;
    // 鳴動中のアラームを無効化できると、停止方法(位置情報)に到達しなくても鳴り止ませられてしまい、
    // このアプリの前提が崩れる。編集・削除と同じく、鳴動中は切り替えも受け付けない
    if (ringingIds.includes(alarm.id)) return;
    setPendingToggles((prev) => ({ ...prev, [alarm.id]: Date.now() }));
    editAlarm(alarm.id, alarm.time, alarm.days_of_week as DayOfWeek[], !alarm.is_enabled, alarm.stop_method_id);
  };

  const isOpen = dialogMode !== null;
  const isEdit = dialogMode?.kind === "edit";
  // 編集中のアラームが鳴動中なら削除も内容変更もさせない(ダイアログを開いたまま鳴り始めた場合も含む)
  const isEditingRingingAlarm = dialogMode?.kind === "edit" && ringingIds.includes(dialogMode.alarm.id);
  // 入力欄は保存中(edge応答待ち)と鳴動中のどちらでも操作不可にする
  const inputsDisabled = saving || isEditingRingingAlarm;

  return (
    <Box sx={{ position: "relative", height: "100%", display: "flex", flexDirection: "column" }}>
      <Backdrop open={saving} sx={{ zIndex: (theme) => theme.zIndex.drawer + 2 }}>
        <Stack spacing={2} sx={{ alignItems: "center", color: "#fff" }}>
          <CircularProgress color="inherit" />
          <Typography sx={{ fontWeight: 700 }}>
            {savingOp === "delete" ? "削除しています…" : "保存しています…"}
          </Typography>
          <Typography variant="caption" sx={{ opacity: 0.7 }}>
            エッジデバイスへの反映を確認しています
          </Typography>
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
        {alarmsUpdatedAt == null ? (
          /* 初回取得中: 一覧の形を模したスケルトンで「読み込み中」であることを伝える */
          <Box sx={{ pt: 1 }}>
            {[0, 1, 2].map((i) => (
              <Box key={i} sx={{ py: 1.5, opacity: 1 - i * 0.25 }}>
                <Skeleton variant="text" sx={{ fontSize: "3.2rem", width: 168 }} />
                <Skeleton variant="text" sx={{ fontSize: "0.875rem", width: 220 }} />
              </Box>
            ))}
            <Stack
              direction="row"
              spacing={1}
              sx={{ alignItems: "center", justifyContent: "center", mt: 3 }}
            >
              <CircularProgress size={14} thickness={5} />
              <Typography variant="caption" color="text.secondary">
                エッジデバイスからアラームを取得しています…
              </Typography>
            </Stack>
          </Box>
        ) : alarms.length === 0 ? (
          <Stack spacing={1} sx={{ alignItems: "center", mt: 8 }}>
            <AlarmOffIcon sx={{ fontSize: 44, color: "text.disabled" }} />
            <Typography variant="body1" color="text.secondary">
              アラームはまだありません
            </Typography>
            <Typography variant="caption" color="text.disabled">
              右上の＋から追加できます
            </Typography>
          </Stack>
        ) : (
          <List disablePadding>
            {alarms.map((alarm, index) => {
              const stopMethod = alarm.stop_method_id
                ? stopMethods.find((m) => m.id === alarm.stop_method_id)
                : undefined;
              // 切り替えを受け付けない理由(handleToggleのガードと対応)。
              // 鳴動中であることを優先して伝える
              const toggleBlockedReason = ringingIds.includes(alarm.id)
                ? "鳴動中は無効にできません。設定した停止方法で止めてください"
                : !alarm.stop_method_id
                  ? "停止方法が未設定のため切り替えできません"
                  : null;
              return (
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
                        {stopMethod ? ` ・ ${stopMethod.label}` : " ・ 停止方法未設定"}
                      </Typography>
                    }
                  />
                  {/* トグルのedge応答待ちの間はスイッチをスピナーに置き換え、
                      操作が処理中であることを行単位で伝える(サイズを固定して行のガタつきを防ぐ) */}
                  <Box
                    sx={{
                      width: 58,
                      height: 38,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {pendingToggles[alarm.id] != null ? (
                      <CircularProgress size={22} />
                    ) : (
                      <Tooltip
                        title={toggleBlockedReason ?? ""}
                        disableHoverListener={!toggleBlockedReason}
                      >
                        <span>
                          <Switch
                            checked={alarm.is_enabled}
                            onChange={(e) => {
                              e.stopPropagation();
                              handleToggle(alarm);
                            }}
                            disabled={!ready || !!toggleBlockedReason}
                          />
                        </span>
                      </Tooltip>
                    )}
                  </Box>
                </ListItem>
                {index < alarms.length - 1 && (
                  <Divider sx={{ borderColor: "rgba(255, 255, 255, 0.12)" }} />
                )}
              </Box>
              );
            })}
          </List>
        )}
      </Box>

      {/* Add / Edit Dialog */}
      <Dialog
        open={isOpen}
        onClose={() => !saving && setDialogMode(null)}
        fullWidth
        maxWidth="xs"
        slotProps={{
          paper: {
            sx: {
              bgcolor: "rgba(20, 20, 20, 0.92)",
              backdropFilter: "blur(20px)",
              backgroundImage: "none",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              borderRadius: 4,
            },
          },
        }}
      >
        <DialogTitle sx={{ textAlign: "center", fontWeight: 700 }}>
          {isEdit ? "アラームを編集" : "アラームを追加"}
        </DialogTitle>
        <DialogContent sx={{ pt: "8px !important" }}>
          {isEditingRingingAlarm && (
            <Alert severity="info" sx={{ mt: 1, borderRadius: 2 }}>
              このアラームは鳴動中のため変更・削除できません。停止してから操作してください。
            </Alert>
          )}

          {/* Time Picker */}
          <TextField
            type="time"
            value={timeInput}
            onChange={(e) => setTimeInput(e.target.value)}
            disabled={inputsDisabled}
            fullWidth
            variant="standard"
            slotProps={{ input: { disableUnderline: true } }}
            sx={{
              mt: 2,
              mb: 4,
              "& .MuiInputBase-input": {
                textAlign: "center",
                fontSize: "2.5rem",
                fontWeight: 200,
                lineHeight: 1.3,
                letterSpacing: "0.04em",
                py: 1,
              },
            }}
          />

          {/* Weekday Selector */}
          <FormControl component="fieldset" fullWidth disabled={inputsDisabled}>
            <FormLabel
              component="legend"
              sx={{
                mb: 1.5,
                fontSize: "0.7rem",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                "&.Mui-focused": { color: "text.secondary" },
              }}
            >
              繰り返す曜日
            </FormLabel>
            <ToggleButtonGroup
              value={selectedDays}
              onChange={(_event, next: DayOfWeek[]) => setSelectedDays(next)}
              disabled={inputsDisabled}
              sx={{
                display: "flex",
                width: "100%",
                gap: 1,
                // ToggleButtonGroupは連結ボタン(セグメントコントロール)向けに
                // 隣接ボタンの左境界線・角丸・マージンを自動で潰すため、
                // 独立した丸ボタンとして揃えるにはグループ側で明示的に打ち消す
                "& .MuiToggleButtonGroup-grouped": {
                  margin: 0,
                  border: "1px solid rgba(255, 255, 255, 0.14) !important",
                  borderRadius: "50% !important",
                },
              }}
            >
              {ALL_DAYS.map((day) => (
                <ToggleButton
                  key={day}
                  value={day}
                  sx={{
                    flex: "1 1 0",
                    minWidth: 0,
                    aspectRatio: "1 / 1",
                    p: 0,
                    fontWeight: 700,
                    fontSize: "0.9rem",
                    color: "text.secondary",
                    transition: "transform 120ms ease, background-color 120ms ease",
                    "&:hover": { bgcolor: "rgba(255, 255, 255, 0.08)" },
                    "&.Mui-selected": {
                      bgcolor: "primary.main",
                      color: "primary.contrastText",
                      transform: "scale(1.05)",
                      "&:hover": { bgcolor: "primary.dark" },
                    },
                  }}
                >
                  {DAY_LABELS[day]}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          </FormControl>

          {/* Stop Method Selector */}
          <FormControl component="fieldset" fullWidth disabled={inputsDisabled} sx={{ mt: 3 }}>
            <FormLabel
              component="legend"
              sx={{
                mb: 1,
                fontSize: "0.7rem",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                "&.Mui-focused": { color: "text.secondary" },
              }}
            >
              停止方法（必須）
            </FormLabel>
            {stopMethods.length === 0 ? (
              <Alert severity="warning" sx={{ borderRadius: 2 }}>
                先に「停止」タブの「停止方法」から位置情報ベースの停止方法を登録してください。
              </Alert>
            ) : (
              <Select
                value={selectedStopMethodId}
                onChange={(e) => setSelectedStopMethodId(e.target.value)}
                displayEmpty
                size="small"
                fullWidth
              >
                <MenuItem value="" disabled>
                  停止方法を選択してください
                </MenuItem>
                {stopMethods.map((method) => (
                  <MenuItem key={method.id} value={method.id}>
                    {method.label}
                  </MenuItem>
                ))}
              </Select>
            )}
          </FormControl>
        </DialogContent>
        <DialogActions sx={{ flexDirection: "column", p: 3, pt: 1, gap: 2 }}>
          <Stack direction="row" spacing={2} sx={{ width: "100%" }}>
            <Button
              onClick={() => !saving && setDialogMode(null)}
              color="inherit"
              fullWidth
              disabled={saving}
              sx={{ borderRadius: 2, py: 1.5 }}
            >
              キャンセル
            </Button>
            <Button
              onClick={handleSave}
              variant="contained"
              fullWidth
              disabled={inputsDisabled || !timeInput || !selectedStopMethodId}
              sx={{ borderRadius: 2, py: 1.5 }}
            >
              保存
            </Button>
          </Stack>
          {isEdit && (
            <Tooltip
              title="鳴動中のアラームは変更・削除できません。先に停止してください。"
              disableHoverListener={!isEditingRingingAlarm}
            >
              <Box sx={{ width: "100%" }}>
                <Button
                  onClick={handleDelete}
                  startIcon={<DeleteIcon />}
                  color="error"
                  fullWidth
                  disabled={saving || isEditingRingingAlarm}
                  sx={{ borderRadius: 2, py: 1.2 }}
                >
                  アラームを削除
                </Button>
              </Box>
            </Tooltip>
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
            {broker.kind === "connecting" ? (
              <>
                <Box
                  sx={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    p: 2,
                    mb: 2,
                    borderRadius: "50%",
                    bgcolor: "rgba(255, 255, 255, 0.06)",
                    color: "text.primary",
                  }}
                >
                  <CircularProgress size={40} />
                </Box>
                <Typography variant="h6" gutterBottom sx={{ fontWeight: "bold" }}>
                  再接続しています…
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  デバイスへ自動で接続を試みています。しばらくお待ちください。
                </Typography>
              </>
            ) : (
              <>
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
              </>
            )}
          </Box>
        </Box>
      )}
    </Box>
  );
}
