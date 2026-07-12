"use client";

import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import DirectionsWalkIcon from "@mui/icons-material/DirectionsWalk";
import NotificationsOffIcon from "@mui/icons-material/NotificationsOff";
import PlaceIcon from "@mui/icons-material/Place";
import { useLocation } from "@/contexts/LocationProvider";
import { useMqtt } from "@/contexts/MqttProvider";
import { useStopMethods } from "@/contexts/StopMethodProvider";
import { useWalkSensorContext } from "@/contexts/WalkSensorProvider";
import { useAppReadiness } from "@/hooks/useAppReadiness";
import { blockReasonLabel } from "@/lib/appState";
import { distanceMeters } from "@/lib/geo";

function fmtDistance(m: number | null): string {
  if (m == null) return "—";
  return m >= 1000 ? `${(m / 1000).toFixed(2)} km` : `${m.toFixed(0)} m`;
}

/**
 * 「アラームを止める」サブタブ。アラームごとに事前設定された停止方法(位置情報)を
 * 自動的に監視して到達したら停止する(実際の送信・停止確認ポップアップは ArrivalStopBridge が担う)。
 * このアプリは「設定した停止地点に到達するまで確実に止められない」ことを意図しているため、
 * ここには手動で止めるボタンなどのフェイルセーフは置かず、状況表示のみを行う。
 * 複数アラームが同時に鳴動している場合は先頭の1件の停止方法のみ表示する(簡易表示)。
 */
export default function StopAlarmControl() {
  const { isWalking } = useWalkSensorContext();
  const { currentPosition } = useLocation();
  const { alarms, ringingStatus } = useMqtt();
  const { stopMethods } = useStopMethods();
  const { alarmManagement } = useAppReadiness();

  const ringingIds = ringingStatus?.ringing_ids ?? [];
  const isRinging = ringingIds.length > 0;
  const ringingAlarm = isRinging ? (alarms.find((a) => a.id === ringingIds[0]) ?? null) : null;
  const stopMethod = ringingAlarm?.stop_method_id
    ? (stopMethods.find((m) => m.id === ringingAlarm.stop_method_id) ?? null)
    : null;
  const distanceToTarget =
    stopMethod && currentPosition ? distanceMeters(currentPosition, stopMethod) : null;
  const hasArrived =
    distanceToTarget != null && stopMethod != null && distanceToTarget <= stopMethod.radiusMeters;

  return (
    <Box sx={{ position: "relative", height: "100%", display: "flex", flexDirection: "column" }}>
      <Stack spacing={3} sx={{ flex: 1, overflowY: "auto" }}>
        {alarmManagement.kind === "blocked" && (
          <Alert severity="warning">{alarmManagement.reasons.map(blockReasonLabel).join(" / ")}</Alert>
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
                <Typography variant="body2" sx={{ opacity: 0.8 }}>
                  歩行中は自動的にアラームを一時停止します
                </Typography>
              </Box>
            </Stack>
          </CardContent>
        </Card>

        {stopMethod ? (
          <Card variant="outlined">
            <CardContent>
              <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 1 }}>
                <PlaceIcon color="primary" fontSize="small" />
                <Typography variant="body2" color="text.secondary">
                  停止方法: {stopMethod.label} まで
                </Typography>
              </Stack>
              <Typography variant="h4">{fmtDistance(distanceToTarget)}</Typography>
              {hasArrived && (
                <Alert severity="success" sx={{ mt: 2 }}>
                  停止地点に到達しました。まもなく自動的に停止します。
                </Alert>
              )}
            </CardContent>
          </Card>
        ) : (
          isRinging && (
            <Alert severity="warning">
              このアラームには位置情報の停止方法が設定されていないため、自動的に停止できません。
              「アラーム」タブで停止方法を設定してください。
            </Alert>
          )
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
