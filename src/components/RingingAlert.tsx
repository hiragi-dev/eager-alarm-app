"use client";

import { useEffect, useRef, useState } from "react";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Snackbar from "@mui/material/Snackbar";
import NotificationsActiveIcon from "@mui/icons-material/NotificationsActive";
import { useMqtt } from "@/contexts/MqttProvider";

/**
 * ringing_statusポーリング結果を監視し、アラームが鳴り始めたら
 * 停止タブへの遷移を促すSnackbarを表示する。
 */
export default function RingingAlert({ onGoToStop }: { onGoToStop: () => void }) {
  const { ringingStatus } = useMqtt();
  const [open, setOpen] = useState(false);
  const prevRingingRef = useRef(false);

  useEffect(() => {
    const isRinging = ringingStatus?.is_ringing === true;
    // 非鳴動 → 鳴動 に切り替わった瞬間だけ表示
    if (isRinging && !prevRingingRef.current) {
      setOpen(true);
    }
    // 鳴動が止まったら自動的に閉じる
    if (!isRinging && prevRingingRef.current) {
      setOpen(false);
    }
    prevRingingRef.current = isRinging;
  }, [ringingStatus]);

  const handleGoToStop = () => {
    setOpen(false);
    onGoToStop();
  };

  return (
    <Snackbar
      open={open}
      anchorOrigin={{ vertical: "top", horizontal: "center" }}
      sx={{ top: { xs: 16 } }}
    >
      <Alert
        severity="warning"
        icon={<NotificationsActiveIcon />}
        action={
          <Button
            color="inherit"
            size="small"
            onClick={handleGoToStop}
            sx={{ fontWeight: 700, whiteSpace: "nowrap" }}
          >
            停止する
          </Button>
        }
        sx={{
          width: "100%",
          alignItems: "center",
          bgcolor: "rgba(255, 180, 0, 0.15)",
          backdropFilter: "blur(12px)",
          border: "1px solid rgba(255, 180, 0, 0.3)",
          color: "#fff",
          "& .MuiAlert-icon": { color: "#FFB400" },
        }}
      >
        アラームが鳴っています！
      </Alert>
    </Snackbar>
  );
}
