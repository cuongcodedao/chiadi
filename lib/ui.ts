/**
 * Chữ nghĩa dùng chung cho giao diện. Tiếng Việt có dấu, thân mật, tự nhiên.
 */

/** Chữ cái đầu cho avatar tròn. */
export function initial(name: string): string {
  return name.trim().charAt(0).toUpperCase();
}

const HAI_PHUT = 2 * 60 * 1000;

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function hhmm(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/**
 * Hôm nay thì hiện giờ, hôm qua thì "Hôm qua", xa hơn thì ngày/tháng.
 * Đúng như màn 3: `Hôm qua`, `08:40`.
 */
export function shortWhen(iso: string, now = new Date()): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";

  if (sameDay(d, now)) {
    return now.getTime() - d.getTime() < HAI_PHUT ? "Vừa xong" : hhmm(d);
  }

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (sameDay(d, yesterday)) return "Hôm qua";

  return `${d.getDate()}/${d.getMonth() + 1}`;
}

/** Nhãn nhóm ngày cho trang lịch sử: "Hôm nay", "Hôm qua", "14/9". */
export function dayLabel(iso: string, now = new Date()): string {
  const d = new Date(iso);
  if (sameDay(d, now)) return "Hôm nay";
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (sameDay(d, yesterday)) return "Hôm qua";
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

export function timeOfDay(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : hhmm(d);
}

/** Dòng phụ dưới tên nhóm ở màn 3: `5 thành viên`. */
export function memberCount(n: number): string {
  return `${n} thành viên`;
}

/** `1 người`, `5 người` — tiếng Việt không đổi dạng số nhiều. */
export function peopleCount(n: number): string {
  return `${n} người`;
}

/**
 * Dòng phụ mỗi khoản chi — chống nghi ngờ, liếc qua là kiểm chứng được
 * mà không cần bấm vào.
 *   `Minh trả · chia cho 5 người`
 *   `Trang và Hùng trả · chia cho 5 người`
 *   `Bạn trả · chia theo suất`
 */
export function expenseSubtitle(params: {
  payerIds: string[];
  shareCount: number;
  splitMode: "equal" | "manual" | "units";
  nameOf: (id: string) => string;
  meId: string | null;
}): string {
  const { payerIds, shareCount, splitMode, nameOf, meId } = params;

  // "Bạn" luôn đứng đầu — "Trang và Bạn trả" nghe sai, "Bạn và Trang trả" mới đúng.
  const ordered = meId
    ? [...payerIds].sort((a, b) => Number(b === meId) - Number(a === meId))
    : payerIds;
  const names = ordered.map((id) => (id === meId ? "Bạn" : nameOf(id)));
  let who: string;
  if (names.length === 0) who = "Chưa rõ ai trả";
  else if (names.length === 1) who = `${names[0]} trả`;
  else if (names.length === 2) who = `${names[0]} và ${names[1]} trả`;
  else who = `${names[0]} và ${names.length - 1} người khác trả`;

  const how =
    splitMode === "units" ? "chia theo suất" : `chia cho ${peopleCount(shareCount)}`;

  return `${who} · ${how}`;
}
