"use client";

import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import DirectionsWalkIcon from "@mui/icons-material/DirectionsWalk";
import { useWalkSensorContext } from "@/contexts/WalkSensorProvider";
import { useLocation } from "@/contexts/LocationProvider";
import { useStopSequence } from "@/contexts/StopSequenceProvider";
import { useAppReadiness } from "@/hooks/useAppReadiness";
import { blockReasonLabel } from "@/lib/appState";

function fmtDistance(m: number | null): string {
  if (m == null) return "—";
  return m >= 1000 ? `${(m / 1000).toFixed(2)} km` : `${m.toFixed(0)} m`;
}

function stopMethodLabel(method: ReturnType<typeof useAppReadiness>["stopMethod"]): string {
  switch (method.kind) {
    case "walk-and-location":
      return "歩行検知 + 位置情報";
    case "walk-only":
      return "歩行検知のみ";
    case "location-only":
      return "位置情報のみ";
    case "none":
      return "未設定";
  }
}

export default function StopAlarmControl() {
  const { isWalking } = useWalkSensorContext();
  const { distanceToTarget, hasArrived, target } = useLocation();
  const { armed, arm, disarm, lastStoppedAt } = useStopSequence();
  const { stopFlow, stopMethod } = useAppReadiness();

  const ready = stopFlow.kind === "ready";

  return (
    <Stack spacing={3}>
      {stopFlow.kind === "blocked" && (
        <Alert severity="warning">{stopFlow.reasons.map(blockReasonLabel).join(" / ")}</Alert>
      )}

      {/* 歩行検知状況を一目でわかるように大きく表示 */}
      <Card
        variant="outlined"
        sx={{
          bgcolor: isWalking ? "success.main" : "action.hover",
          color: isWalking ? "success.contrastText" : "text.primary",
          transition: "background-color 0.2s ease",
        }}
      >
        <CardContent>
          <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
            <DirectionsWalkIcon sx={{ fontSize: 48 }} />
            <Box>
              <Typography variant="h4" component="div">
                {isWalking ? "歩行を検知中" : "静止中"}
              </Typography>
              {armed && (
                <Typography variant="body2" sx={{ opacity: 0.8 }}>
                  停止シーケンス有効（{stopMethodLabel(stopMethod)}）
                </Typography>
              )}
            </Box>
          </Stack>
        </CardContent>
      </Card>

      <Button
        variant="contained"
        size="large"
        color={armed ? "inherit" : "error"}
        onClick={armed ? disarm : arm}
        disabled={!armed && !ready}
      >
        {armed ? "停止シーケンスを解除" : "アラームを止める"}
      </Button>

      {armed && target && (
        <Card variant="outlined">
          <CardContent>
            <Typography variant="body2" color="text.secondary">
              停止地点までの距離
            </Typography>
            <Typography variant="h4">{fmtDistance(distanceToTarget)}</Typography>
            {hasArrived && (
              <Alert severity="success" sx={{ mt: 2 }}>
                停止地点に到達しました。
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {lastStoppedAt && (
        <Alert severity="success">
          {new Date(lastStoppedAt).toLocaleTimeString("ja-JP", { hour12: false })}{" "}
          にアラームを完全に停止するコマンドを送信しました。
        </Alert>
      )}
    </Stack>
  );
}
