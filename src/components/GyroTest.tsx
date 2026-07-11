"use client";

import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useGyro } from "@/contexts/GyroProvider";

function fmt(n: number | null | undefined, unit: string): string {
  return n == null ? "—" : `${n.toFixed(1)}${unit}`;
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <Box sx={{ minWidth: 84 }}>
      <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
        {label}
      </Typography>
      <Typography variant="h5">{value}</Typography>
    </Box>
  );
}

export default function GyroTest() {
  const {
    supported,
    secureContext,
    permission,
    requestPermission,
    orientation,
    motion,
    lastEventAt,
    isWalking,
    stepCount,
  } = useGyro();

  if (supported === false) {
    return (
      <Alert severity="error">
        このブラウザ/デバイスは DeviceOrientation / DeviceMotion に対応していません。
      </Alert>
    );
  }

  if (secureContext === false) {
    return (
      <Alert severity="warning">
        セキュアコンテキストではありません（HTTP接続）。スマホ実機でジャイロを使うには
        HTTPS（または localhost）でアクセスする必要があります。PWA配信時はHTTPS化が必須です。
      </Alert>
    );
  }

  if (permission === "denied") {
    return (
      <Alert severity="warning">
        センサーの利用が拒否されています。ブラウザの設定から許可してください。
      </Alert>
    );
  }

  if (permission === "prompt") {
    return (
      <Card variant="outlined">
        <CardContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            傾き・加速度センサーを使うには許可が必要です。
          </Typography>
          <Button variant="contained" onClick={requestPermission}>
            センサーの利用を許可
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Stack spacing={3}>
      <Card variant="outlined">
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2 }}>
            傾き (DeviceOrientation)
          </Typography>
          <Stack direction="row" spacing={3}>
            <StatBox label="alpha (Z)" value={fmt(orientation?.alpha, "°")} />
            <StatBox label="beta (X)" value={fmt(orientation?.beta, "°")} />
            <StatBox label="gamma (Y)" value={fmt(orientation?.gamma, "°")} />
          </Stack>
        </CardContent>
      </Card>

      <Card variant="outlined">
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2 }}>
            回転速度 (DeviceMotion / rotationRate)
          </Typography>
          <Stack direction="row" spacing={3}>
            <StatBox label="alpha" value={fmt(motion?.rotationAlpha, "°/s")} />
            <StatBox label="beta" value={fmt(motion?.rotationBeta, "°/s")} />
            <StatBox label="gamma" value={fmt(motion?.rotationGamma, "°/s")} />
          </Stack>
        </CardContent>
      </Card>

      <Card variant="outlined">
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2 }}>
            加速度 (DeviceMotion / acceleration)
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1 }}>
            重力の影響を除いた値。端末によっては非対応で常に — になります。
          </Typography>
          <Stack direction="row" spacing={3} sx={{ mb: 2 }}>
            <StatBox label="x" value={fmt(motion?.accelerationX, "m/s²")} />
            <StatBox label="y" value={fmt(motion?.accelerationY, "m/s²")} />
            <StatBox label="z" value={fmt(motion?.accelerationZ, "m/s²")} />
          </Stack>

          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1 }}>
            重力を含む値（ほぼ全端末で対応）
          </Typography>
          <Stack direction="row" spacing={3}>
            <StatBox label="x" value={fmt(motion?.accelerationGravityX, "m/s²")} />
            <StatBox label="y" value={fmt(motion?.accelerationGravityY, "m/s²")} />
            <StatBox label="z" value={fmt(motion?.accelerationGravityZ, "m/s²")} />
          </Stack>

          <Divider sx={{ my: 2 }} />

          <Typography variant="body2" color="text.secondary">
            {lastEventAt
              ? `最終受信: ${new Date(lastEventAt).toLocaleTimeString("ja-JP", { hour12: false })}（数値が変化し続けていれば検知できています）`
              : "まだセンサーデータを受信していません。スマホでこのページを開き、端末を動かしてください。"}
          </Typography>
        </CardContent>
      </Card>

      <Card variant="outlined">
        <CardContent>
          <Stack
            direction="row"
            spacing={1}
            sx={{ alignItems: "center", justifyContent: "space-between", mb: 2 }}
          >
            <Typography variant="h6">歩行検知</Typography>
            <Chip
              size="small"
              label={isWalking ? "歩行中" : "静止中"}
              color={isWalking ? "success" : "default"}
            />
          </Stack>
          <Typography variant="body2" color="text.secondary">
            加速度センサーの変動から簡易的に歩行を検知しています（検知した歩数: {stepCount}）。
            この検知結果を使ってPiへコマンドを送るには「アラームを止める」タブを使用してください。
          </Typography>
        </CardContent>
      </Card>
    </Stack>
  );
}
