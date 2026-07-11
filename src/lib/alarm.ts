/** eager-alarm-edge の `eager-alarm/<id>/alarms` トピックで返される1件のアラーム */
export type Alarm = {
  id: string;
  wakeup_time: string;
};

export type AlarmCommand =
  | { type: "add"; wakeup_time: string }
  | { type: "delete"; id: string }
  | { type: "list" }
  | { type: "pause"; duration_ms: number }
  | { type: "stop" }
  | { type: "status" };

export function buildAddCommand(wakeupTime: string): AlarmCommand {
  return { type: "add", wakeup_time: wakeupTime };
}

export function buildDeleteCommand(id: string): AlarmCommand {
  return { type: "delete", id };
}

export function buildListCommand(): AlarmCommand {
  return { type: "list" };
}

/**
 * 鳴動中のアラームを durationMs だけ一時停止するコマンド。
 * 歩行検知中に一定間隔で再送することで、歩行が続く限り停止状態を延長する想定
 * （eager-alarm-edge 側は明示的な resume を待たず、durationMs 経過で自動的に鳴動を再開する）。
 */
export function buildPauseCommand(durationMs: number): AlarmCommand {
  return { type: "pause", duration_ms: durationMs };
}

/** 鳴動中のアラームを完全に停止するコマンド（durationによる自動再開は無し） */
export function buildStopCommand(): AlarmCommand {
  return { type: "stop" };
}

/**
 * edgeデバイスの生存確認コマンド。`status` トピックへの応答(publish)の有無で
 * オンライン/オフラインを判定する想定（MQTTブローカーへの接続状況とは別に扱う）。
 * eager-alarm-edge 側にはまだ実装されていないが、既定APIとして扱う。
 */
export function buildStatusCommand(): AlarmCommand {
  return { type: "status" };
}

/**
 * `<input type="datetime-local">` の値（"YYYY-MM-DDTHH:mm" または "...:ss"）を、
 * eager-alarm-edge が受け付ける "YYYY-MM-DD HH:MM:SS" 形式（デバイスのローカル時刻として解釈される）に変換する。
 */
export function datetimeLocalToWakeupTime(value: string): string {
  const withSeconds = value.length === 16 ? `${value}:00` : value;
  return withSeconds.replace("T", " ");
}

/** RFC3339（オフセット付き）と "YYYY-MM-DD HH:MM:SS" のどちらも Date に変換できるようにする */
function parseWakeupTime(wakeupTime: string): Date {
  const iso = wakeupTime.includes("T") ? wakeupTime : wakeupTime.replace(" ", "T");
  return new Date(iso);
}

/** 一覧表示用に読みやすい形式へ整形する。パース不能な場合は元の文字列を返す */
export function formatWakeupTime(wakeupTime: string): string {
  const d = parseWakeupTime(wakeupTime);
  if (Number.isNaN(d.getTime())) return wakeupTime;
  return d.toLocaleString("ja-JP", { hour12: false });
}

/** 起床時刻が早い順に並べ替える（デバイス側は既にソート済みだが表示側でも保証する） */
export function sortAlarmsByWakeupTime(alarms: Alarm[]): Alarm[] {
  return [...alarms].sort(
    (a, b) => parseWakeupTime(a.wakeup_time).getTime() - parseWakeupTime(b.wakeup_time).getTime(),
  );
}
