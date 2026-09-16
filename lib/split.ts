/**
 * TOÀN BỘ logic tính tiền của ChiaDi.
 *
 * File này không import gì cả — không next, không db, không react.
 * Đây là phần dễ sai âm thầm nhất, nên nó phải chạy test được một mình.
 *
 * Bất biến tuyệt đối:
 *   1. Tiền luôn là số nguyên, đơn vị đồng. Không bao giờ float.
 *   2. Mỗi khoản chi: tổng payers = tổng shares = total.
 *   3. Share được tính sẵn và lưu lại, không lưu tỷ lệ rồi tính lúc render.
 *   4. Tổng số dư toàn nhóm luôn bằng 0.
 */

export type MemberId = string;

/** Số nguyên đồng. Không bao giờ có phần thập phân. */
export type Money = number;

export type Expense = {
  id: string;
  total: Money;
  /** Ai bỏ tiền ra, bao nhiêu. */
  payers: Record<MemberId, Money>;
  /** Ai hưởng, bao nhiêu. Đã tính sẵn thành tiền, không phải tỷ lệ. */
  shares: Record<MemberId, Money>;
};

export type Settlement = { from: MemberId; to: MemberId; amount: Money };

/** amount > 0: được nhận. amount < 0: đang nợ. */
export type Balance = { memberId: MemberId; amount: Money };

export type Transfer = { from: MemberId; to: MemberId; amount: Money };

/**
 * Cửa ải duy nhất chặn float lọt vào. Gọi ở mọi biên.
 */
export function assertMoney(n: number, label: string): void {
  if (!Number.isSafeInteger(n)) {
    throw new Error(
      `${label} phải là số nguyên đồng, nhận được ${String(n)}`,
    );
  }
}

function sumValues(record: Record<string, number>): number {
  let total = 0;
  for (const value of Object.values(record)) total += value;
  return total;
}

/**
 * Chia một khoản tiền theo suất. "Chia đều" và "chia theo suất" là cùng một
 * phép toán, chỉ khác số suất — nên chỉ có một thuật toán làm tròn trong app.
 *
 * Phần lẻ chia theo dư lớn nhất (largest remainder), hòa thì ưu tiên người
 * đứng trước trong `order`. Làm bằng số nguyên, không dùng float, nên kết quả
 * y hệt nhau trên mọi máy — cùng một khoản chi luôn ra cùng một cách chia
 * bất kể ai bấm lưu.
 */
export function splitByUnits(
  total: Money,
  units: Record<MemberId, number>,
  order?: MemberId[],
): Record<MemberId, Money> {
  assertMoney(total, "Tổng tiền");
  if (total < 0) throw new Error("Tổng tiền không được âm");

  const ids = order ?? Object.keys(units);
  if (ids.length === 0) throw new Error("Phải có ít nhất một người để chia");

  let sumUnits = 0;
  for (const id of ids) {
    const unit = units[id] ?? 0;
    assertMoney(unit, `Số suất của ${id}`);
    if (unit < 0) throw new Error(`Số suất của ${id} không được âm`);
    sumUnits += unit;
  }
  if (sumUnits <= 0) throw new Error("Tổng số suất phải lớn hơn 0");

  // numerator tối đa ~ total * unit; với tiền Việt và nhóm bạn bè thì còn
  // rất xa Number.MAX_SAFE_INTEGER, nhưng vẫn kiểm cho chắc.
  const result: Record<MemberId, Money> = {};
  const remainders: { id: MemberId; rem: number; index: number }[] = [];
  let distributed = 0;

  ids.forEach((id, index) => {
    const numerator = total * (units[id] ?? 0);
    assertMoney(numerator, `Phép chia của ${id}`);
    const base = Math.floor(numerator / sumUnits);
    result[id] = base;
    distributed += base;
    remainders.push({ id, rem: numerator % sumUnits, index });
  });

  let leftover = total - distributed;
  remainders.sort((a, b) => b.rem - a.rem || a.index - b.index);
  for (const entry of remainders) {
    if (leftover <= 0) break;
    result[entry.id] += 1;
    leftover -= 1;
  }

  return result;
}

/**
 * Chia đều — mỗi người một suất.
 * 100.000đ chia 3 không chia hết; ai chịu đồng lẻ được quyết ngay tại đây.
 */
export function splitEqual(
  total: Money,
  memberIds: MemberId[],
): Record<MemberId, Money> {
  const units: Record<MemberId, number> = {};
  for (const id of memberIds) units[id] = 1;
  return splitByUnits(total, units, memberIds);
}

/**
 * Bất biến 2. Ném lỗi bằng giọng giao diện — thông báo này hiện thẳng
 * trong sheet thêm khoản chi, không qua lớp dịch nào.
 *
 * Bản sao ở database là `assert_expense_balanced`. Giữ cả hai: bản này
 * để báo cho người dùng, bản kia là thứ không thể lách.
 */
export function validateExpense(e: Expense): void {
  assertMoney(e.total, "Số tiền");
  if (e.total <= 0) throw new Error("Số tiền phải lớn hơn 0");

  for (const [id, amount] of Object.entries(e.payers)) {
    assertMoney(amount, `Số tiền ${id} đã trả`);
    if (amount < 0) throw new Error(`Số tiền ${id} đã trả không được âm`);
  }
  for (const [id, amount] of Object.entries(e.shares)) {
    assertMoney(amount, `Phần của ${id}`);
    if (amount < 0) throw new Error(`Phần của ${id} không được âm`);
  }

  const paid = sumValues(e.payers);
  if (paid !== e.total) {
    const diff = e.total - paid;
    throw new Error(
      diff > 0
        ? `Người trả còn thiếu ${formatVnd(diff)} so với tổng khoản chi`
        : `Người trả thừa ${formatVnd(-diff)} so với tổng khoản chi`,
    );
  }

  const shared = sumValues(e.shares);
  if (shared !== e.total) {
    const diff = e.total - shared;
    throw new Error(
      diff > 0
        ? `Còn thiếu ${formatVnd(diff)} chưa chia`
        : `Đã chia thừa ${formatVnd(-diff)}`,
    );
  }
}

/**
 * Số dư từng người. Dương là được nhận, âm là đang nợ.
 *
 * Xếp từ người nợ nhiều nhất xuống người được nhận nhiều nhất — thứ tự này
 * là quyết định thiết kế (màn 6), không phải chi tiết hiển thị, nên nó nằm ở đây.
 *
 * Khoản chi đã xóa mềm phải được lọc trước khi gọi — hàm này không biết
 * đến khái niệm xóa.
 */
export function computeBalances(
  expenses: Expense[],
  settlements: Settlement[],
  memberIds: MemberId[],
): Balance[] {
  const balances = new Map<MemberId, Money>();
  // Người chưa dính khoản nào vẫn phải xuất hiện với 0đ.
  for (const id of memberIds) balances.set(id, 0);

  const bump = (id: MemberId, delta: Money) => {
    balances.set(id, (balances.get(id) ?? 0) + delta);
  };

  for (const expense of expenses) {
    validateExpense(expense);
    for (const [id, paid] of Object.entries(expense.payers)) bump(id, paid);
    for (const [id, owed] of Object.entries(expense.shares)) bump(id, -owed);
  }

  for (const s of settlements) {
    assertMoney(s.amount, "Số tiền chuyển");
    if (s.amount <= 0) throw new Error("Số tiền chuyển phải lớn hơn 0");
    // Trả nợ thì số dư người trả đi lên phía 0, người nhận đi xuống.
    bump(s.from, s.amount);
    bump(s.to, -s.amount);
  }

  const result: Balance[] = [...balances].map(([memberId, amount]) => ({
    memberId,
    amount,
  }));

  // Bất biến 4.
  const total = result.reduce((acc, b) => acc + b.amount, 0);
  if (total !== 0) {
    throw new Error(
      `Tổng số dư cả nhóm phải bằng 0, đang lệch ${formatVnd(total)}`,
    );
  }

  return result.sort(
    (a, b) => a.amount - b.amount || a.memberId.localeCompare(b.memberId),
  );
}

/**
 * "Cách trả gọn nhất" ở màn 6 — tham lam, ghép người nợ nhiều nhất với
 * người được nhận nhiều nhất. Sinh ra tối đa n−1 lần chuyển.
 *
 * Không đảm bảo tối thiểu tuyệt đối (bài toán đó NP-hard), nhưng với quy mô
 * một nhóm bạn thì kết quả trùng với tối ưu.
 */
export function minimizeTransfers(balances: Balance[]): Transfer[] {
  const debtors = balances
    .filter((b) => b.amount < 0)
    .map((b) => ({ id: b.memberId, amount: -b.amount }))
    .sort((a, b) => b.amount - a.amount || a.id.localeCompare(b.id));
  const creditors = balances
    .filter((b) => b.amount > 0)
    .map((b) => ({ id: b.memberId, amount: b.amount }))
    .sort((a, b) => b.amount - a.amount || a.id.localeCompare(b.id));

  const transfers: Transfer[] = [];
  let d = 0;
  let c = 0;

  while (d < debtors.length && c < creditors.length) {
    const debtor = debtors[d];
    const creditor = creditors[c];
    const amount = Math.min(debtor.amount, creditor.amount);

    if (amount > 0) {
      transfers.push({ from: debtor.id, to: creditor.id, amount });
      debtor.amount -= amount;
      creditor.amount -= amount;
    }

    if (debtor.amount === 0) d += 1;
    if (creditor.amount === 0) c += 1;
  }

  return transfers;
}

/**
 * `450.000đ` — chấm ngăn nghìn, `đ` liền sau, không khoảng trắng, không thập phân.
 * Số âm dùng dấu trừ thật `−` (U+2212), không phải gạch nối.
 */
export function formatVnd(n: Money, options?: { sign?: boolean }): string {
  assertMoney(n, "Số tiền");

  const digits = Math.abs(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".");

  const prefix = n < 0 ? "−" : options?.sign && n > 0 ? "+" : "";
  return `${prefix}${digits}đ`;
}

/**
 * Nghịch đảo của formatVnd, cho ô nhập số tiền vừa gõ vừa định dạng.
 * Trả về null khi không đọc được — người gọi tự quyết hiện lỗi gì.
 */
export function parseVnd(input: string): Money | null {
  const cleaned = input.replace(/[.\s,đĐ]/g, "").replace(/−/g, "-");
  if (cleaned === "" || cleaned === "-") return null;
  if (!/^-?\d+$/.test(cleaned)) return null;

  const value = Number(cleaned);
  return Number.isSafeInteger(value) ? value : null;
}
