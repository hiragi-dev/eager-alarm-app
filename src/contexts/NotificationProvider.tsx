"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import Alert from "@mui/material/Alert";
import Snackbar from "@mui/material/Snackbar";

export type NotificationSeverity = "error" | "warning" | "info" | "success";

type QueuedNotification = { key: number; severity: NotificationSeverity; message: string };

type NotifyFn = (severity: NotificationSeverity, message: string) => void;

const NotificationContext = createContext<NotifyFn | null>(null);

/** NotificationProvider配下でのみ使用可能。エラー等をポップアップ(Snackbar)で表示する */
export function useNotify(): NotifyFn {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error("useNotify must be used within NotificationProvider");
  return ctx;
}

let nextKey = 0;

/**
 * アプリ全体のエラー/通知をポップアップで表示するProvider。
 * 複数の通知が短時間に発生しても、MUI公式の「連続するSnackbar」パターンで
 * 1件ずつ順番に表示する（前の通知が閉じてから次を出す）。
 */
export default function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [queue, setQueue] = useState<QueuedNotification[]>([]);
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState<QueuedNotification | undefined>(undefined);

  const notify = useCallback<NotifyFn>((severity, message) => {
    setQueue((prev) => [...prev, { key: nextKey++, severity, message }]);
  }, []);

  useEffect(() => {
    if (queue.length > 0 && !current) {
      // キューを1件ずつ処理して表示する（MUI公式の「連続するSnackbar」パターン）
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCurrent(queue[0]);
      setQueue((prev) => prev.slice(1));
      setOpen(true);
    } else if (queue.length > 0 && current && open) {
      // 次の通知がある場合は今の通知を閉じてから出す
      setOpen(false);
    }
  }, [queue, current, open]);

  const handleClose = useCallback((_event: unknown, reason?: string) => {
    if (reason === "clickaway") return;
    setOpen(false);
  }, []);

  const handleExited = useCallback(() => {
    setCurrent(undefined);
  }, []);

  return (
    <NotificationContext.Provider value={notify}>
      {children}
      <Snackbar
        key={current?.key}
        open={open}
        autoHideDuration={current?.severity === "error" ? 8000 : 5000}
        onClose={handleClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        slotProps={{ transition: { onExited: handleExited } }}
      >
        {current ? (
          <Alert onClose={handleClose} severity={current.severity} variant="filled" sx={{ width: "100%" }}>
            {current.message}
          </Alert>
        ) : undefined}
      </Snackbar>
    </NotificationContext.Provider>
  );
}
