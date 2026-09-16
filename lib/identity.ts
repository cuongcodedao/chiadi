/**
 * Nhận diện thành viên không cần đăng nhập: trình duyệt nhớ mình là ai
 * trong từng nhóm. Đây là toàn bộ "tài khoản" của ChiaDi.
 *
 * localStorage có thể ném lỗi (chế độ riêng tư, chặn cookie) nên mọi lần
 * đọc ghi đều bọc try/catch và giao diện phải chạy được khi nó trả về null.
 */

const KEY = (slug: string) => `chiadi:me:${slug}`;

export function readIdentity(slug: string): string | null {
  try {
    return window.localStorage.getItem(KEY(slug));
  } catch {
    return null;
  }
}

/**
 * Tài khoản nhận tiền của chính người đang dùng máy này. Nhớ ở trình duyệt để
 * vào nhóm mới không phải gõ lại — chỉ gợi ý sẵn cho chính chủ, không bao giờ
 * điền hộ người khác (điền nhầm là tiền chạy sai tài khoản).
 */
const BANK_KEY = "chiadi:bank";

export type RememberedBank = { code: string; account: string; holder: string };

export function readBank(): RememberedBank | null {
  try {
    const raw = window.localStorage.getItem(BANK_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<RememberedBank>;
    if (!parsed?.code || !parsed.account || !parsed.holder) return null;
    return { code: parsed.code, account: parsed.account, holder: parsed.holder };
  } catch {
    return null;
  }
}

export function rememberBank(bank: RememberedBank): void {
  try {
    window.localStorage.setItem(BANK_KEY, JSON.stringify(bank));
  } catch {
    // Không nhớ được thì lần sau gõ lại — phiền, nhưng không hỏng.
  }
}

/**
 * Danh sách nhóm đã mở trên máy này. Không có tài khoản nên mất link là mất
 * đường vào — đây là cái phao duy nhất, và nó chỉ nằm trong trình duyệt.
 */
const GROUPS_KEY = "chiadi:groups";

export type RecentGroup = { slug: string; name: string; at: number };

export function readGroups(): RecentGroup[] {
  try {
    const raw = window.localStorage.getItem(GROUPS_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (g): g is RecentGroup =>
          typeof g?.slug === "string" &&
          typeof g?.name === "string" &&
          typeof g?.at === "number",
      )
      .sort((a, b) => b.at - a.at);
  } catch {
    return [];
  }
}

export function rememberGroup(slug: string, name: string): void {
  try {
    const rest = readGroups().filter((g) => g.slug !== slug);
    const next = [{ slug, name, at: Date.now() }, ...rest].slice(0, 8);
    window.localStorage.setItem(GROUPS_KEY, JSON.stringify(next));
  } catch {
    // Không nhớ được thì trang chủ không hiện nhóm gần đây, chỉ vậy thôi.
  }
}

export function forgetGroup(slug: string): void {
  try {
    const next = readGroups().filter((g) => g.slug !== slug);
    window.localStorage.setItem(GROUPS_KEY, JSON.stringify(next));
  } catch {
    // Bỏ qua.
  }
}

export function rememberIdentity(slug: string, memberId: string | null): void {
  try {
    if (memberId) window.localStorage.setItem(KEY(slug), memberId);
    else window.localStorage.removeItem(KEY(slug));
  } catch {
    // Không nhớ được thì màn 2 sẽ hỏi lại — phiền, nhưng không hỏng.
  }
}
