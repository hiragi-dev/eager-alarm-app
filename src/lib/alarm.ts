export type DayOfWeek = "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun";

/**
 * eager-alarm-edge の `eager-alarm/<id>/alarms` トピックで返される1件のアラーム。
 * stop_method_id はブラウザ側(StopMethodProvider)で管理する位置情報ベースの
 * 停止方法のIDを指す不透明な文字列で、edge側はこの値の意味を解釈しない
 * (どのアラームがどの停止方法に紐づいているかを覚えておくためだけに保持・往復させる)。
 * 本アプリのUIでは新規作成時に必須入力だが、edge側の実装都合や移行前のデータでは
 * 欠落している場合もあるため型としてはnull許容にしている。
 */
export type Alarm = {
  id: string;
  time: string; // "HH:MM"
  days_of_week: DayOfWeek[];
  is_enabled: boolean;
  stop_method_id: string | null;
  is_nfc_enabled: boolean;
};

export type AlarmCommand =
  | {
    type: "add";
    time: string;
    days_of_week: DayOfWeek[];
    is_enabled: boolean;
    stop_method_id: string;
    is_nfc_enabled: boolean;
  }
  | {
    type: "edit";
    id: string;
    time: string;
    days_of_week: DayOfWeek[];
    is_enabled: boolean;
    stop_method_id: string;
    is_nfc_enabled: boolean;
  }
  | { type: "delete"; id: string }
  | { type: "list" }
  | { type: "pause"; duration_ms: number }
  | { type: "stop" }
  | { type: "status" }
  | { type: "ringing_status" };

export type RingingStatus = {
  is_ringing: boolean;
  ringing_ids: string[];
};

export function buildAddCommand(
  time: string,
  daysOfWeek: DayOfWeek[],
  isEnabled: boolean,
  stopMethodId: string,
  isNfcEnabled: boolean,
): AlarmCommand {
  return {
    type: "add",
    time,
    days_of_week: daysOfWeek,
    is_enabled: isEnabled,
    stop_method_id: stopMethodId,
    is_nfc_enabled: isNfcEnabled,
  };
}

export function buildEditCommand(
  id: string,
  time: string,
  daysOfWeek: DayOfWeek[],
  isEnabled: boolean,
  stopMethodId: string,
  isNfcEnabled: boolean,
): AlarmCommand {
  return {
    type: "edit",
    id,
    time,
    days_of_week: daysOfWeek,
    is_enabled: isEnabled,
    stop_method_id: stopMethodId,
    is_nfc_enabled: isNfcEnabled
  };
}

export function buildDeleteCommand(id: string): AlarmCommand {
  return { type: "delete", id };
}

export function buildListCommand(): AlarmCommand {
  return { type: "list" };
}

export function buildPauseCommand(durationMs: number): AlarmCommand {
  return { type: "pause", duration_ms: durationMs };
}

export function buildStopCommand(): AlarmCommand {
  return { type: "stop" };
}

export function buildStatusCommand(): AlarmCommand {
  return { type: "status" };
}

export function buildRingingStatusCommand(): AlarmCommand {
  return { type: "ringing_status" };
}

/** 時刻が早い順に並べ替える ("HH:MM" 形式の文字列比較) */
export function sortAlarmsByTime(alarms: Alarm[]): Alarm[] {
  return [...alarms].sort((a, b) => a.time.localeCompare(b.time));
}

/** 曜日を日本語表記にフォーマットする */
export function formatDaysOfWeek(days: DayOfWeek[]): string {
  if (days.length === 0) return "なし";
  if (days.length === 7) return "毎日";

  const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri"];
  const weekend = ["Sat", "Sun"];

  const isWeekdays = weekdays.every(d => days.includes(d as DayOfWeek)) && days.length === 5;
  if (isWeekdays) return "平日";

  const isWeekend = weekend.every(d => days.includes(d as DayOfWeek)) && days.length === 2;
  if (isWeekend) return "週末";

  const map: Record<DayOfWeek, string> = {
    Mon: "月", Tue: "火", Wed: "水", Thu: "木", Fri: "金", Sat: "土", Sun: "日"
  };

  // 決まった順序で表示するためのソート
  const order: DayOfWeek[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const sorted = [...days].sort((a, b) => order.indexOf(a) - order.indexOf(b));

  return sorted.map(d => map[d]).join(" ");
}
