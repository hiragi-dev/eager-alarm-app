"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
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
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import AddIcon from "@mui/icons-material/Add";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import CloseIcon from "@mui/icons-material/Close";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import PlaceIcon from "@mui/icons-material/Place";
import InfoPopoverButton from "@/components/InfoPopoverButton";
import { useLocation } from "@/contexts/LocationProvider";
import { useMqtt } from "@/contexts/MqttProvider";
import { useStopMethods } from "@/contexts/StopMethodProvider";
import { DEFAULT_STOP_METHOD_RADIUS_METERS, type StopMethod } from "@/lib/stopMethod";
import type { GeoPoint } from "@/lib/geo";

// Leafletはwindow/documentに依存しSSR非対応なため動的importでクライアントのみ読み込む
const LocationPickerMap = dynamic(() => import("@/components/LocationPickerMap"), {
  ssr: false,
  loading: () => (
    <Box sx={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <CircularProgress size={28} />
    </Box>
  ),
});

/** 地図の初期中心地点（現在地取得前の暫定値。東京駅） */
const FALLBACK_CENTER: GeoPoint = { lat: 35.6812, lng: 139.7671 };

/** 編集フローのステップ: まず地図で地点を選び、次に名前を入力する */
type EditorStep = "pick" | "details";

/** 編集ダイアログの対象。新規追加か、既存の停止方法の編集か */
type Editor = { kind: "add" } | { kind: "edit"; id: string };

export default function StopMethodSettings() {
  const { stopMethods, addStopMethod, updateStopMethod, deleteStopMethod } = useStopMethods();
  const { alarms, ringingStatus } = useMqtt();
  const { currentPosition, permission, startWatching } = useLocation();

  const [editor, setEditor] = useState<Editor | null>(null);
  const [step, setStep] = useState<EditorStep>("pick");
  const [label, setLabel] = useState("");
  const [radiusInput, setRadiusInput] = useState(String(DEFAULT_STOP_METHOD_RADIUS_METERS));
  const [picked, setPicked] = useState<GeoPoint | null>(null);
  // 地図で内容を確認しているだけの停止方法(閲覧専用)
  const [viewingId, setViewingId] = useState<string | null>(null);

  // ダイアログを開いたら現在地を掴めるようにしておく(地図の初期中心・現在地表示に使う)
  const mapOpen = editor !== null || viewingId !== null;
  useEffect(() => {
    if (mapOpen && permission !== "unsupported" && permission !== "insecure") {
      startWatching();
    }
  }, [mapOpen, permission, startWatching]);

  const usedStopMethodIds = new Set(
    alarms.map((a) => a.stop_method_id).filter((id): id is string => !!id),
  );

  const viewing = viewingId ? (stopMethods.find((m) => m.id === viewingId) ?? null) : null;

  // 鳴動中に停止地点を書き換えられると、鳴っているアラームの停止条件を
  // その場で好きな場所にずらせてしまう。停止するまで変更させない
  const isRinging = (ringingStatus?.ringing_ids ?? []).length > 0;
  const editBlockedByRinging = editor?.kind === "edit" && isRinging;

  const openAddDialog = () => {
    setLabel("");
    setRadiusInput(String(DEFAULT_STOP_METHOD_RADIUS_METERS));
    // クリック(またはマーカーごと現在地に移動するボタン)で選ぶまではピンを立てない
    setPicked(null);
    setStep("pick");
    setEditor({ kind: "add" });
  };

  const openEditDialog = (method: StopMethod) => {
    setLabel(method.label);
    setRadiusInput(String(method.radiusMeters));
    setPicked({ lat: method.lat, lng: method.lng });
    setStep("pick");
    setViewingId(null);
    setEditor({ kind: "edit", id: method.id });
  };

  const handleSave = () => {
    const radius = Number(radiusInput);
    if (!editor || !label.trim() || !picked || !Number.isFinite(radius) || radius <= 0) return;
    const input = {
      label: label.trim(),
      lat: picked.lat,
      lng: picked.lng,
      radiusMeters: radius,
    };
    if (editor.kind === "edit") {
      // ダイアログを開いたまま鳴り始めた場合も保存させない
      if (isRinging) return;
      updateStopMethod(editor.id, input);
    } else {
      addStopMethod(input);
    }
    setEditor(null);
  };

  const canSave =
    label.trim().length > 0 && !!picked && Number(radiusInput) > 0 && !editBlockedByRinging;

  const editorInitialCenter = picked ?? currentPosition ?? FALLBACK_CENTER;

  return (
    <Stack spacing={3}>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
          <Typography variant="h6">停止方法（位置情報）</Typography>
          <InfoPopoverButton>
            ここで登録した停止方法は、「アラーム」タブでアラームごとに1つ選んで割り当てます。
            鳴動中のアラームに割り当てられた地点まで移動すると、自動的にアラームを停止します。
          </InfoPopoverButton>
        </Stack>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openAddDialog}>
          追加
        </Button>
      </Box>

      {stopMethods.length === 0 ? (
        <Stack spacing={1} sx={{ alignItems: "center", py: 5 }}>
          <PlaceIcon sx={{ fontSize: 40, color: "text.disabled" }} />
          <Typography variant="body2" color="text.secondary">
            まだ停止方法が登録されていません
          </Typography>
          <Typography variant="caption" color="text.disabled">
            「追加」から地図で地点を選んで登録できます
          </Typography>
        </Stack>
      ) : (
        <List
          disablePadding
          sx={{
            bgcolor: "rgba(255, 255, 255, 0.04)",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            borderRadius: 3,
            px: 2,
            py: 0.5,
          }}
        >
          {stopMethods.map((method, index) => {
            const inUse = usedStopMethodIds.has(method.id);
            return (
              <Box key={method.id}>
                <ListItem
                  disableGutters
                  sx={{ cursor: "pointer" }}
                  onClick={() => setViewingId(method.id)}
                  secondaryAction={
                    <Tooltip
                      title={inUse ? "いずれかのアラームで使用中のため削除できません" : ""}
                      disableHoverListener={!inUse}
                    >
                      <span>
                        <IconButton
                          edge="end"
                          aria-label="削除"
                          onClick={(e) => {
                            // 行タップ(地図で確認)と競合させない
                            e.stopPropagation();
                            deleteStopMethod(method.id);
                          }}
                          disabled={inUse}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                  }
                >
                  <PlaceIcon sx={{ mr: 1.5, color: "primary.main" }} />
                  <ListItemText
                    primary={method.label}
                    secondary={`到達判定 半径${method.radiusMeters}m${inUse ? " ・ 使用中" : ""}`}
                  />
                </ListItem>
                {index < stopMethods.length - 1 && <Divider />}
              </Box>
            );
          })}
        </List>
      )}

      {stopMethods.length > 0 && (
        <Typography variant="caption" color="text.disabled" sx={{ mt: -2 }}>
          タップすると地図で場所を確認・編集できます
        </Typography>
      )}

      {/* 地図で内容を確認する(閲覧専用) */}
      <Dialog
        open={viewing !== null}
        onClose={() => setViewingId(null)}
        fullScreen
        sx={{ "& .MuiDialog-paper": { display: "flex", flexDirection: "column" } }}
      >
        <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", py: 1.5 }}>
          {viewing?.label}
          <IconButton onClick={() => setViewingId(null)} aria-label="閉じる">
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ flex: 1, display: "flex", flexDirection: "column", p: 0, overflow: "hidden" }}>
          <Box sx={{ flex: 1, position: "relative" }}>
            {viewing && (
              <LocationPickerMap
                initialCenter={{ lat: viewing.lat, lng: viewing.lng }}
                value={{ lat: viewing.lat, lng: viewing.lng }}
                onSelect={() => {}}
                readOnly
                currentPosition={currentPosition}
                height="100%"
                borderRadius={0}
                radiusMeters={viewing.radiusMeters}
              />
            )}
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2, alignItems: "center", gap: 1 }}>
          <Typography
            variant="body2"
            color={isRinging ? "warning.main" : "text.secondary"}
            sx={{ flex: 1 }}
          >
            {isRinging
              ? "アラームが鳴っている間は変更できません"
              : `到達判定 半径${viewing?.radiusMeters}m`}
          </Typography>
          <Tooltip
            title="アラームが鳴っている間は変更できません"
            disableHoverListener={!isRinging}
          >
            <span>
              <Button
                variant="contained"
                startIcon={<EditIcon />}
                disabled={isRinging}
                onClick={() => viewing && openEditDialog(viewing)}
              >
                編集
              </Button>
            </span>
          </Tooltip>
        </DialogActions>
      </Dialog>

      {/* Step 1: 地図で地点を選ぶ(全画面表示で最大限広く使う) */}
      <Dialog
        open={editor !== null && step === "pick"}
        onClose={() => setEditor(null)}
        fullScreen
        sx={{ "& .MuiDialog-paper": { display: "flex", flexDirection: "column" } }}
      >
        <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", py: 1.5 }}>
          {editor?.kind === "edit" ? "停止地点を変更" : "停止地点を選択"}
          <IconButton onClick={() => setEditor(null)} aria-label="閉じる">
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ flex: 1, display: "flex", flexDirection: "column", p: 0, overflow: "hidden" }}>
          <Box sx={{ flex: 1, position: "relative" }}>
            <LocationPickerMap
              initialCenter={editorInitialCenter}
              value={picked}
              onSelect={setPicked}
              currentPosition={currentPosition}
              height="100%"
              borderRadius={0}
              radiusMeters={Number(radiusInput) || DEFAULT_STOP_METHOD_RADIUS_METERS}
              onRadiusChange={(r) => setRadiusInput(String(r))}
              readOnly={editBlockedByRinging}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2, alignItems: "center" }}>
          <Typography
            variant="body2"
            color={editBlockedByRinging ? "warning.main" : "text.secondary"}
            sx={{ flex: 1 }}
          >
            {editBlockedByRinging
              ? "アラームが鳴り始めたため変更できません"
              : picked
                ? "地点を選択しました"
                : "地図をタップして停止地点を選択してください"}
          </Typography>
          <Button
            variant="contained"
            disabled={!picked || editBlockedByRinging}
            onClick={() => setStep("details")}
          >
            次へ
          </Button>
        </DialogActions>
      </Dialog>

      {/* Step 2: 名前・到達判定半径を入力する */}
      <Dialog open={editor !== null && step === "details"} onClose={() => setEditor(null)} fullWidth maxWidth="xs">
        <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <IconButton onClick={() => setStep("pick")} edge="start" aria-label="地図に戻る">
            <ArrowBackIcon />
          </IconButton>
          名前を設定
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {editBlockedByRinging && (
              <Alert severity="info" sx={{ borderRadius: 2 }}>
                アラームが鳴り始めたため保存できません。停止してから変更してください。
              </Alert>
            )}
            <TextField
              label="名前"
              placeholder="例: 会社、駅前"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              disabled={editBlockedByRinging}
              fullWidth
              size="small"
              autoFocus
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setEditor(null)} color="inherit">
            キャンセル
          </Button>
          <Button onClick={handleSave} variant="contained" disabled={!canSave}>
            保存
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
