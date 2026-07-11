"use client";

import { useState } from "react";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useLocation, type LocationPermission } from "@/contexts/LocationProvider";
import { DEFAULT_RADIUS_METERS } from "@/lib/geo";

const blockedMessage: Partial<Record<LocationPermission, string>> = {
  unsupported: "この端末/ブラウザは位置情報に対応していません。",
  insecure:
    "セキュアコンテキストではありません（HTTP接続）。位置情報の取得には HTTPS（または localhost）が必要です。",
  denied: "位置情報の利用が拒否されています。ブラウザの設定から許可してください。",
};

export default function LocationSettings() {
  const {
    permission,
    watching,
    startWatching,
    currentPosition,
    target,
    registerCurrentLocationAsTarget,
    setTargetRadius,
    clearTarget,
  } = useLocation();
  const [radiusInput, setRadiusInput] = useState(
    String(target?.radiusMeters ?? DEFAULT_RADIUS_METERS),
  );

  const blockMessage = blockedMessage[permission];

  return (
    <Stack spacing={3}>
      {blockMessage && <Alert severity="warning">{blockMessage}</Alert>}

      <Card variant="outlined">
        <CardContent>
          <Stack
            direction="row"
            spacing={1}
            sx={{ alignItems: "center", justifyContent: "space-between", mb: 2 }}
          >
            <Typography variant="h6">現在地</Typography>
            {watching && <Chip size="small" label="取得中" color="success" />}
          </Stack>

          {!watching && (
            <Button variant="contained" onClick={startWatching} disabled={!!blockMessage}>
              位置情報の取得を開始
            </Button>
          )}

          {currentPosition && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
              緯度: {currentPosition.lat.toFixed(6)} / 経度: {currentPosition.lng.toFixed(6)}
              （精度: 約{currentPosition.accuracy.toFixed(0)}m）
            </Typography>
          )}
        </CardContent>
      </Card>

      <Card variant="outlined">
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2 }}>
            アラーム停止地点
          </Typography>

          {target ? (
            <Stack spacing={2}>
              <Typography variant="body2">
                緯度: {target.lat.toFixed(6)} / 経度: {target.lng.toFixed(6)}
              </Typography>
              <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
                <TextField
                  label="到達判定の半径 (m)"
                  type="number"
                  size="small"
                  value={radiusInput}
                  onChange={(e) => setRadiusInput(e.target.value)}
                  sx={{ maxWidth: 200 }}
                />
                <Button
                  variant="outlined"
                  onClick={() => {
                    const n = Number(radiusInput);
                    if (Number.isFinite(n) && n > 0) setTargetRadius(n);
                  }}
                >
                  半径を更新
                </Button>
              </Stack>
              <Divider />
              <Stack direction="row" spacing={2}>
                <Button
                  variant="contained"
                  onClick={() => registerCurrentLocationAsTarget(target.radiusMeters)}
                  disabled={!currentPosition}
                >
                  現在地で上書き
                </Button>
                <Button variant="outlined" color="error" onClick={clearTarget}>
                  登録を削除
                </Button>
              </Stack>
            </Stack>
          ) : (
            <Stack spacing={2}>
              <Typography variant="body2" color="text.secondary">
                まだ停止地点が登録されていません。現在地を取得してから登録してください。
              </Typography>
              <Button
                variant="contained"
                onClick={() =>
                  registerCurrentLocationAsTarget(Number(radiusInput) || DEFAULT_RADIUS_METERS)
                }
                disabled={!currentPosition}
              >
                現在地を停止地点として登録
              </Button>
            </Stack>
          )}
        </CardContent>
      </Card>
    </Stack>
  );
}
