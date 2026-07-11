"use client";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import DirectionsWalkIcon from "@mui/icons-material/DirectionsWalk";
import NotificationsOffIcon from "@mui/icons-material/NotificationsOff";
import { useWalkSensorContext } from "@/contexts/WalkSensorProvider";
import { useLocation } from "@/contexts/LocationProvider";
import { useStopSequence } from "@/contexts/StopSequenceProvider";
import { useAppReadiness } from "@/hooks/useAppReadiness";
import { useMqtt } from "@/contexts/MqttProvider";
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
  const { ringingStatus } = useMqtt();

  const ready = stopFlow.kind === "ready";
  const isRinging = ringingStatus?.is_ringing === true;

  return (
    <Box sx={{ position: "relative", height: "100%", display: "flex", flexDirection: "column" }}>
      <Stack spacing={3} sx={{ flex: 1, overflowY: "auto" }}>
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

      {/* アラームが鳴っていない場合のオーバーレイ */}
      {!isRinging && (
        <Box
          sx={{
            position: "absolute",
            inset: -16,
            zIndex: 10,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            bgcolor: "rgba(0, 0, 0, 0.55)",
            backdropFilter: "blur(6px)",
            borderRadius: 4,
            p: 3,
          }}
        >
          <Box
            sx={{
              maxWidth: 380,
              width: "100%",
              bgcolor: "rgba(28, 28, 30, 0.85)",
              backdropFilter: "blur(24px)",
              boxShadow: "0 20px 50px rgba(0, 0, 0, 0.6)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              borderRadius: 4,
              textAlign: "center",
              py: 5,
              px: 3,
            }}
          >
            <Box
              sx={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                p: 2.5,
                mb: 2.5,
                borderRadius: "50%",
                bgcolor: "rgba(255, 255, 255, 0.07)",
                color: "rgba(255,255,255,0.4)",
              }}
            >
              <NotificationsOffIcon sx={{ fontSize: 44 }} />
            </Box>
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 700, color: "rgba(255,255,255,0.85)" }}>
              現在アラームは鳴っていません
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7 }}>
              アラームが鳴り始めると、<br />
              ここで停止操作ができます。
            </Typography>
            {ringingStatus === null && (
              <Typography variant="caption" color="text.disabled" sx={{ display: "block", mt: 2 }}>
                接続中…
              </Typography>
            )}
          </Box>
        </Box>
      )}
    </Box>
  );
}
