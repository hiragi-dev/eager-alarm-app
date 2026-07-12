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
import AddIcon from "@mui/icons-material/Add";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import CloseIcon from "@mui/icons-material/Close";
import DeleteIcon from "@mui/icons-material/Delete";
import PlaceIcon from "@mui/icons-material/Place";
import InfoPopoverButton from "@/components/InfoPopoverButton";
import { useLocation } from "@/contexts/LocationProvider";
import { useMqtt } from "@/contexts/MqttProvider";
import { useStopMethods } from "@/contexts/StopMethodProvider";
import { DEFAULT_STOP_METHOD_RADIUS_METERS } from "@/lib/stopMethod";
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

/** 追加フローのステップ: まず地図で地点を選び、次に名前・半径を入力する */
type AddStep = "pick" | "details";

export default function StopMethodSettings() {
  const { stopMethods, addStopMethod, deleteStopMethod } = useStopMethods();
  const { alarms } = useMqtt();
  const { currentPosition, permission, startWatching } = useLocation();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [step, setStep] = useState<AddStep>("pick");
  const [label, setLabel] = useState("");
  const [radiusInput, setRadiusInput] = useState(String(DEFAULT_STOP_METHOD_RADIUS_METERS));
  const [picked, setPicked] = useState<GeoPoint | null>(null);

  // ダイアログを開いたら現在地を掴めるようにしておく(地図の初期中心に使う)
  useEffect(() => {
    if (dialogOpen && permission !== "unsupported" && permission !== "insecure") {
      startWatching();
    }
  }, [dialogOpen, permission, startWatching]);

  const usedStopMethodIds = new Set(
    alarms.map((a) => a.stop_method_id).filter((id): id is string => !!id),
  );

  const openAddDialog = () => {
    setLabel("");
    setRadiusInput(String(DEFAULT_STOP_METHOD_RADIUS_METERS));
    // クリック(またはマーカーごと現在地に移動するボタン)で選ぶまではピンを立てない
    setPicked(null);
    setStep("pick");
    setDialogOpen(true);
  };

  const handleSave = () => {
    const radius = Number(radiusInput);
    if (!label.trim() || !picked || !Number.isFinite(radius) || radius <= 0) return;
    addStopMethod({ label: label.trim(), lat: picked.lat, lng: picked.lng, radiusMeters: radius });
    setDialogOpen(false);
  };

  const canSave = label.trim().length > 0 && !!picked && Number(radiusInput) > 0;

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
        <Typography variant="body2" color="text.secondary">
          まだ停止方法が登録されていません。「追加」から地図で地点を選んで登録してください。
        </Typography>
      ) : (
        <List disablePadding>
          {stopMethods.map((method, index) => {
            const inUse = usedStopMethodIds.has(method.id);
            return (
              <Box key={method.id}>
                <ListItem
                  disableGutters
                  secondaryAction={
                    <Tooltip
                      title={inUse ? "いずれかのアラームで使用中のため削除できません" : ""}
                      disableHoverListener={!inUse}
                    >
                      <span>
                        <IconButton
                          edge="end"
                          aria-label="削除"
                          onClick={() => deleteStopMethod(method.id)}
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

      {/* Step 1: 地図で地点を選ぶ(全画面表示で最大限広く使う) */}
      <Dialog
        open={dialogOpen && step === "pick"}
        onClose={() => setDialogOpen(false)}
        fullScreen
        sx={{ "& .MuiDialog-paper": { display: "flex", flexDirection: "column" } }}
      >
        <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", py: 1.5 }}>
          停止地点を選択
          <IconButton onClick={() => setDialogOpen(false)} aria-label="閉じる">
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ flex: 1, display: "flex", flexDirection: "column", p: 0, overflow: "hidden" }}>
          <Box sx={{ flex: 1, position: "relative" }}>
            <LocationPickerMap
              initialCenter={
                currentPosition
                  ? { lat: currentPosition.lat, lng: currentPosition.lng }
                  : FALLBACK_CENTER
              }
              value={picked}
              onSelect={setPicked}
              currentPosition={currentPosition}
              height="100%"
              borderRadius={0}
              radiusMeters={Number(radiusInput) || DEFAULT_STOP_METHOD_RADIUS_METERS}
              onRadiusChange={(r) => setRadiusInput(String(r))}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2, alignItems: "center" }}>
          <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
            {picked ? "地点を選択しました" : "地図をタップして停止地点を選択してください"}
          </Typography>
          <Button variant="contained" disabled={!picked} onClick={() => setStep("details")}>
            次へ
          </Button>
        </DialogActions>
      </Dialog>

      {/* Step 2: 名前・到達判定半径を入力する */}
      <Dialog open={dialogOpen && step === "details"} onClose={() => setDialogOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <IconButton onClick={() => setStep("pick")} edge="start" aria-label="地図に戻る">
            <ArrowBackIcon />
          </IconButton>
          名前を設定
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="名前"
              placeholder="例: 会社、駅前"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              fullWidth
              size="small"
              autoFocus
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setDialogOpen(false)} color="inherit">
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
