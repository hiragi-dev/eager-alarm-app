"use client";

import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useLocation, type LocationPermission } from "@/contexts/LocationProvider";

const blockedMessage: Partial<Record<LocationPermission, string>> = {
  unsupported: "この端末/ブラウザは位置情報に対応していません。",
  insecure:
    "セキュアコンテキストではありません（HTTP接続）。位置情報の取得には HTTPS（または localhost）が必要です。",
  denied: "位置情報の利用が拒否されています。ブラウザの設定から許可してください。",
};

/**
 * 現在地取得の許可状況の確認・取得開始のみを扱う。
 * 「どこで止めるか」の登録・管理は「停止」タブの「停止方法」で行う
 * (src/components/StopMethodSettings.tsx)。
 */
export default function LocationSettings() {
  const { permission, watching, startWatching, currentPosition } = useLocation();

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

      <Alert severity="info">
        アラームを止める地点の登録は、「停止」タブの「停止方法」から行えます。
      </Alert>
    </Stack>
  );
}
