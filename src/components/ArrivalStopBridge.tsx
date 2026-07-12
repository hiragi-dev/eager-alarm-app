"use client";

import { useEffect, useState } from "react";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import Typography from "@mui/material/Typography";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import { useLocation } from "@/contexts/LocationProvider";
import { useMqtt } from "@/contexts/MqttProvider";
import { useStopMethods } from "@/contexts/StopMethodProvider";
import { distanceMeters } from "@/lib/geo";

/** 送信成功後、ringing_statusで停止を確認できなければこの時間で再送する */
const CONFIRMATION_TIMEOUT_MS = 8000;
/** 送信失敗時、この時間待ってから再送する */
const RETRY_DELAY_MS = 3000;
/** 停止確認後、ポップアップを自動的に閉じるまでの時間 */
const AUTO_DISMISS_MS = 4000;

type StoppingPhase = "sending" | "waiting-confirmation" | "confirmed";
type StoppingState = { alarmId: string; attempts: number; phase: StoppingPhase };

/**
 * 位置情報(LocationProvider)・停止方法(StopMethodProvider)・MQTT送信(MqttProvider)を
 * 橋渡しし、鳴動中のアラームが割り当てられた停止方法の地点に到達したら自動的に
 * stopコマンドを送信する。アラームごとに事前に停止方法が紐づいているため、
 * 手動で「有効化」する操作は不要で、鳴動中は自動的に監視される。
 *
 * このアプリは「特定のトリガーが起きるまで確実に止められない」ことを意図しており、
 * 手動の「今すぐ止める」ボタンのようなフェイルセーフは設けない。代わりに、到達時は
 * MQTT配信(QoS2)の確認・ringing_statusによる実際の停止確認が取れるまでブロッキングの
 * ポップアップを表示し続け、確認できなければ自動的に再送し続ける。
 * どのタブを表示していても動作するよう、page.tsxの最上位で常時マウントしておく。
 */
export default function ArrivalStopBridge() {
  const { currentPosition, permission, startWatching } = useLocation();
  const { status, alarms, ringingStatus, sendStopCommand } = useMqtt();
  const { stopMethods } = useStopMethods();
  const [stopping, setStopping] = useState<StoppingState | null>(null);

  const ringingIds = ringingStatus?.ringing_ids ?? [];
  const ringingIdsKey = ringingIds.join(",");

  // 鳴動中は自動的に現在地監視を開始する(位置情報ベースの停止方法を使うアラームのため)
  useEffect(() => {
    if (ringingIds.length === 0) return;
    if (permission === "unsupported" || permission === "insecure" || permission === "denied") return;
    startWatching();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ringingIdsKey, permission, startWatching]);

  // 到達判定: 停止処理が進行中でなければ、鳴動中の各アラームについて
  // 割り当てられた停止方法の地点との距離を確認し、範囲内なら停止処理を開始する
  useEffect(() => {
    if (status !== "connected" || ringingIds.length === 0 || !currentPosition || stopping) return;

    for (const alarmId of ringingIds) {
      const alarm = alarms.find((a) => a.id === alarmId);
      const method = alarm?.stop_method_id
        ? stopMethods.find((m) => m.id === alarm.stop_method_id)
        : undefined;
      if (!method) continue;

      const distance = distanceMeters(currentPosition, method);
      if (distance <= method.radiusMeters) {
        // 到達検知に同期して停止処理を開始する
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setStopping({ alarmId, attempts: 1, phase: "sending" });
        break;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, ringingIdsKey, currentPosition, alarms, stopMethods, stopping]);

  // sending: stopコマンドを送信する。QoS2配信が確認できたら waiting-confirmation へ
  useEffect(() => {
    if (!stopping || stopping.phase !== "sending") return;
    let cancelled = false;
    const { alarmId } = stopping;

    sendStopCommand().then((delivered) => {
      if (cancelled || !delivered) return;
      setStopping((prev) =>
        prev && prev.alarmId === alarmId && prev.phase === "sending"
          ? { ...prev, phase: "waiting-confirmation" }
          : prev,
      );
    });

    return () => {
      cancelled = true;
    };
    // stopping全体ではなく個々のフィールドを見て再実行要否を判定する(オブジェクト参照の変化では反応させない)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stopping?.alarmId, stopping?.phase, stopping?.attempts, sendStopCommand]);

  // sending失敗時(未接続等でdelivered=falseのまま)、一定時間後に再送する
  useEffect(() => {
    if (!stopping || stopping.phase !== "sending") return;
    const { alarmId } = stopping;
    const id = setTimeout(() => {
      setStopping((prev) =>
        prev && prev.alarmId === alarmId && prev.phase === "sending"
          ? { ...prev, attempts: prev.attempts + 1 }
          : prev,
      );
    }, RETRY_DELAY_MS);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stopping?.alarmId, stopping?.phase, stopping?.attempts]);

  // waiting-confirmation: ringing_statusから当該アラームが消えたら確認完了とする
  useEffect(() => {
    if (!stopping || stopping.phase !== "waiting-confirmation") return;
    if (!ringingIds.includes(stopping.alarmId)) {
      const { alarmId } = stopping;
      // ringing_statusの受信(=別Providerの状態変化)に同期して確認済みにする
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStopping((prev) =>
        prev && prev.alarmId === alarmId && prev.phase === "waiting-confirmation"
          ? { ...prev, phase: "confirmed" }
          : prev,
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stopping?.alarmId, stopping?.phase, ringingIdsKey]);

  // waiting-confirmationのまま確認が取れない場合、念のため再送する
  // (edge側が取りこぼした・応答が遅い場合の安全網)
  useEffect(() => {
    if (!stopping || stopping.phase !== "waiting-confirmation") return;
    const { alarmId } = stopping;
    const id = setTimeout(() => {
      setStopping((prev) =>
        prev && prev.alarmId === alarmId && prev.phase === "waiting-confirmation"
          ? { ...prev, phase: "sending", attempts: prev.attempts + 1 }
          : prev,
      );
    }, CONFIRMATION_TIMEOUT_MS);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stopping?.alarmId, stopping?.phase, stopping?.attempts]);

  // confirmed: 一定時間後に自動的にポップアップを閉じる
  useEffect(() => {
    if (!stopping || stopping.phase !== "confirmed") return;
    const id = setTimeout(() => setStopping(null), AUTO_DISMISS_MS);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stopping?.alarmId, stopping?.phase]);

  const isConfirmed = stopping?.phase === "confirmed";

  return (
    <Dialog
      open={stopping !== null}
      onClose={() => {
        // 送信中/確認中はEscapeやバックドロップクリックで閉じさせない(フェイルセーフを設けないため)
        if (isConfirmed) setStopping(null);
      }}
      slotProps={{
        paper: {
          sx: {
            bgcolor: "rgba(20, 20, 20, 0.95)",
            backdropFilter: "blur(20px)",
            backgroundImage: "none",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            borderRadius: 4,
            textAlign: "center",
            py: 5,
            px: 4,
            minWidth: 280,
          },
        },
      }}
    >
      {isConfirmed ? (
        <>
          <CheckCircleIcon color="success" sx={{ fontSize: 48, mb: 2 }} />
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
            アラームを停止しました
          </Typography>
          <Button variant="contained" onClick={() => setStopping(null)} sx={{ mt: 2 }}>
            閉じる
          </Button>
        </>
      ) : (
        <>
          <CircularProgress sx={{ mb: 2 }} />
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
            {stopping?.phase === "sending" ? "停止信号を送信しています…" : "停止を確認しています…"}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            停止地点に到達しました。アラームが完全に停止するまでこの画面が表示されます。
          </Typography>
          {stopping && stopping.attempts > 1 && (
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
              再試行中（{stopping.attempts}回目）
            </Typography>
          )}
        </>
      )}
    </Dialog>
  );
}
