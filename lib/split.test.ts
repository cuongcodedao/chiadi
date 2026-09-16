import test from "node:test";
import assert from "node:assert/strict";

import {
  computeBalances,
  formatVnd,
  minimizeTransfers,
  parseVnd,
  splitByUnits,
  splitEqual,
  validateExpense,
  type Balance,
  type Expense,
  type MemberId,
} from "./split.ts";

const MEMBERS = ["minh", "hung", "lan", "huy", "trang"];

function sum(record: Record<string, number>): number {
  return Object.values(record).reduce((a, b) => a + b, 0);
}

// ---------------------------------------------------------------- 1
test("splitEqual chia hết thì mỗi người bằng nhau", () => {
  const shares = splitEqual(850_000, MEMBERS);

  assert.deepEqual(shares, {
    minh: 170_000,
    hung: 170_000,
    lan: 170_000,
    huy: 170_000,
    trang: 170_000,
  });
  assert.equal(sum(shares), 850_000);
});

// ---------------------------------------------------------------- 2
test("splitEqual 100.000đ cho 3 người — đồng lẻ về người đầu, định dạng đúng", () => {
  const shares = splitEqual(100_000, ["a", "b", "c"]);

  assert.deepEqual(shares, { a: 33_334, b: 33_333, c: 33_333 });
  // Không được tạo ra hay làm mất một đồng nào.
  assert.equal(sum(shares), 100_000);

  assert.equal(formatVnd(450_000), "450.000đ");
  assert.equal(formatVnd(0), "0đ");
  assert.equal(formatVnd(1_800_000), "1.800.000đ");
  assert.equal(formatVnd(390_000, { sign: true }), "+390.000đ");

  // Dấu trừ phải là U+2212, không phải gạch nối — nhìn bằng mắt không phân biệt được.
  const negative = formatVnd(-450_000);
  assert.equal(negative, "−450.000đ");
  assert.equal(negative.codePointAt(0), 0x2212);

  assert.equal(parseVnd("450.000đ"), 450_000);
  assert.equal(parseVnd("−450.000đ"), -450_000);
  assert.equal(parseVnd(""), null);
  assert.equal(parseVnd("abc"), null);
  assert.equal(parseVnd(formatVnd(33_334)), 33_334);
});

// ---------------------------------------------------------------- 3
test("splitEqual cho kết quả y hệt khi gọi lại — không phụ thuộc thứ tự lặp", () => {
  const first = splitEqual(1_000_000, MEMBERS);
  const second = splitEqual(1_000_000, MEMBERS);
  assert.deepEqual(first, second);

  // 1.000.000 chia 5 hết, nhưng 1.000.001 thì không.
  const odd1 = splitEqual(1_000_001, MEMBERS);
  const odd2 = splitEqual(1_000_001, MEMBERS);
  assert.deepEqual(odd1, odd2);
  assert.equal(odd1.minh, 200_001);
  assert.equal(sum(odd1), 1_000_001);
});

// ---------------------------------------------------------------- 4
test("splitByUnits chia theo suất đúng tỷ lệ", () => {
  const shares = splitByUnits(100_000, { a: 2, b: 1, c: 1 }, ["a", "b", "c"]);

  assert.deepEqual(shares, { a: 50_000, b: 25_000, c: 25_000 });
  assert.equal(sum(shares), 100_000);
});

// ---------------------------------------------------------------- 5
test("splitByUnits dồn phần lẻ cho suất có dư lớn nhất", () => {
  // 100.000 × 2/3 = 66.666,67 → 66.667 mới là làm tròn công bằng.
  const shares = splitByUnits(100_000, { a: 2, b: 1 }, ["a", "b"]);

  assert.deepEqual(shares, { a: 66_667, b: 33_333 });
  assert.equal(sum(shares), 100_000);

  // Người không ăn suất nào thì không phải trả đồng nào.
  const skipped = splitByUnits(90_000, { a: 1, b: 0, c: 2 }, ["a", "b", "c"]);
  assert.deepEqual(skipped, { a: 30_000, b: 0, c: 60_000 });

  assert.throws(
    () => splitByUnits(100_000, { a: 0, b: 0 }, ["a", "b"]),
    /Tổng số suất phải lớn hơn 0/,
  );
});

// ---------------------------------------------------------------- 6
test("validateExpense chấp nhận khoản chi nhiều người cùng trả", () => {
  const expense: Expense = {
    id: "homestay",
    total: 1_800_000,
    payers: { trang: 1_000_000, hung: 800_000 },
    shares: splitEqual(1_800_000, MEMBERS),
  };

  assert.doesNotThrow(() => validateExpense(expense));
});

// ---------------------------------------------------------------- 7
test("validateExpense từ chối số tiền không lớn hơn 0", () => {
  const zero: Expense = { id: "x", total: 0, payers: {}, shares: {} };
  assert.throws(() => validateExpense(zero), /^Error: Số tiền phải lớn hơn 0$/);

  const negative: Expense = {
    id: "x",
    total: -1000,
    payers: { minh: -1000 },
    shares: { minh: -1000 },
  };
  assert.throws(() => validateExpense(negative), /Số tiền phải lớn hơn 0/);

  const fractional: Expense = {
    id: "x",
    total: 100.5,
    payers: { minh: 100.5 },
    shares: { minh: 100.5 },
  };
  assert.throws(() => validateExpense(fractional), /phải là số nguyên đồng/);
});

// ---------------------------------------------------------------- 8
test("validateExpense từ chối khi tổng người trả không khớp tổng khoản chi", () => {
  const expense: Expense = {
    id: "x",
    total: 850_000,
    payers: { minh: 800_000 },
    shares: splitEqual(850_000, MEMBERS),
  };

  assert.throws(
    () => validateExpense(expense),
    /Người trả còn thiếu 50.000đ so với tổng khoản chi/,
  );
});

// ---------------------------------------------------------------- 9
test("validateExpense nói rõ còn thiếu bao nhiêu chưa chia", () => {
  // Đúng tình huống màn 5: nhập tay, tổng chưa khớp.
  const expense: Expense = {
    id: "x",
    total: 850_000,
    payers: { minh: 850_000 },
    shares: { minh: 250_000, hung: 200_000, lan: 200_000, huy: 120_000, trang: 0 },
  };

  assert.throws(
    () => validateExpense(expense),
    /^Error: Còn thiếu 80.000đ chưa chia$/,
  );

  const over: Expense = {
    ...expense,
    shares: { ...expense.shares, trang: 130_000 },
  };
  assert.throws(() => validateExpense(over), /^Error: Đã chia thừa 50.000đ$/);
});

// ---------------------------------------------------------------- 10
test("computeBalances tính đúng nhóm nhiều khoản, nhiều người trả, xếp nợ nhiều nhất trước", () => {
  // Kịch bản dựng riêng cho test. Con số trên các màn mockup được vẽ độc lập
  // từng màn nên không suy ra được từ danh sách khoản chi của màn 3.
  const expenses: Expense[] = [
    {
      id: "an-toi",
      total: 850_000,
      payers: { minh: 850_000 },
      shares: splitEqual(850_000, MEMBERS),
    },
    {
      id: "homestay",
      total: 1_800_000,
      payers: { trang: 1_000_000, hung: 800_000 },
      shares: splitEqual(1_800_000, MEMBERS),
    },
    {
      id: "ca-phe",
      total: 165_000,
      payers: { hung: 165_000 },
      shares: splitEqual(165_000, ["hung", "lan", "trang"]),
    },
  ];

  const balances = computeBalances(expenses, [], MEMBERS);

  assert.deepEqual(balances, [
    { memberId: "lan", amount: -585_000 },
    { memberId: "huy", amount: -530_000 },
    { memberId: "minh", amount: 320_000 },
    { memberId: "hung", amount: 380_000 },
    { memberId: "trang", amount: 415_000 },
  ]);

  assert.equal(
    balances.reduce((acc, b) => acc + b.amount, 0),
    0,
  );
});

// ---------------------------------------------------------------- 11
test("computeBalances giữ người chưa dính khoản nào ở 0đ và trừ dần khi đã chuyển", () => {
  const expenses: Expense[] = [
    {
      id: "xang",
      total: 420_000,
      payers: { huy: 420_000 },
      shares: splitEqual(420_000, ["huy", "trang"]),
    },
  ];

  const before = computeBalances(expenses, [], MEMBERS);
  const lan = before.find((b) => b.memberId === "lan");
  assert.equal(lan?.amount, 0, "Lân không tham gia khoản nào, phải là 0đ");
  assert.equal(before.find((b) => b.memberId === "trang")?.amount, -210_000);

  // Trang chuyển đủ 210.000đ cho Huy thì cả hai về 0.
  const after = computeBalances(
    expenses,
    [{ from: "trang", to: "huy", amount: 210_000 }],
    MEMBERS,
  );
  assert.ok(after.every((b) => b.amount === 0));
});

// ---------------------------------------------------------------- 12
test("minimizeTransfers đưa mọi người về 0 và không quá n−1 lần chuyển", () => {
  const balances: Balance[] = [
    { memberId: "lan", amount: -620_000 },
    { memberId: "hung", amount: -450_000 },
    { memberId: "huy", amount: 0 },
    { memberId: "trang", amount: 390_000 },
    { memberId: "minh", amount: 680_000 },
  ];

  const transfers = minimizeTransfers(balances);

  assert.ok(
    transfers.length <= balances.length - 1,
    `Cần tối đa 4 lần chuyển, sinh ra ${transfers.length}`,
  );
  assert.ok(transfers.every((t) => t.amount > 0));
  // Người đã cân bằng không được xuất hiện trong danh sách.
  assert.ok(transfers.every((t) => t.from !== "huy" && t.to !== "huy"));

  const settled = new Map(balances.map((b) => [b.memberId, b.amount]));
  for (const t of transfers) {
    settled.set(t.from, settled.get(t.from)! + t.amount);
    settled.set(t.to, settled.get(t.to)! - t.amount);
  }
  for (const [id, amount] of settled) {
    assert.equal(amount, 0, `${id} còn lệch ${formatVnd(amount)}`);
  }
});

// ---------------------------------------------------------------- 13
test("bất biến giữ vững trên 500 nhóm ngẫu nhiên", () => {
  // PRNG có hạt giống để lần chạy nào cũng giống nhau — test đỏ là tái hiện được.
  let seed = 0x9e3779b9;
  const rand = () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const randInt = (min: number, max: number) =>
    min + Math.floor(rand() * (max - min + 1));

  for (let iteration = 0; iteration < 500; iteration++) {
    const memberCount = randInt(2, 12);
    const members: MemberId[] = Array.from(
      { length: memberCount },
      (_, i) => `m${i}`,
    );

    const expenses: Expense[] = [];
    const expenseCount = randInt(1, 8);

    for (let e = 0; e < expenseCount; e++) {
      const total = randInt(1, 10_000_000);

      // Người trả và người hưởng đều sinh bằng splitByUnits nên luôn khớp tổng —
      // vừa đảm bảo dữ liệu hợp lệ, vừa ép splitByUnits chạy hàng nghìn lần.
      const payerUnits: Record<MemberId, number> = {};
      const shareUnits: Record<MemberId, number> = {};
      do {
        for (const id of members) payerUnits[id] = rand() < 0.3 ? randInt(1, 4) : 0;
      } while (Object.values(payerUnits).every((u) => u === 0));
      do {
        for (const id of members) shareUnits[id] = rand() < 0.7 ? randInt(1, 4) : 0;
      } while (Object.values(shareUnits).every((u) => u === 0));

      const payers = splitByUnits(total, payerUnits, members);
      const shares = splitByUnits(total, shareUnits, members);

      // Bất biến 1 và 2.
      for (const amount of [...Object.values(payers), ...Object.values(shares)]) {
        assert.ok(Number.isSafeInteger(amount));
        assert.ok(amount >= 0);
      }
      assert.equal(sum(payers), total, `lần ${iteration}: tổng người trả lệch`);
      assert.equal(sum(shares), total, `lần ${iteration}: tổng chia lệch`);

      const expense: Expense = { id: `e${e}`, total, payers, shares };
      assert.doesNotThrow(() => validateExpense(expense));
      expenses.push(expense);
    }

    // Bất biến 4 — computeBalances tự ném nếu lệch.
    const balances = computeBalances(expenses, [], members);
    assert.equal(
      balances.reduce((acc, b) => acc + b.amount, 0),
      0,
      `lần ${iteration}: tổng số dư khác 0`,
    );

    const transfers = minimizeTransfers(balances);
    assert.ok(transfers.length <= members.length - 1);

    const settled = new Map(balances.map((b) => [b.memberId, b.amount]));
    for (const t of transfers) {
      assert.ok(t.amount > 0);
      settled.set(t.from, settled.get(t.from)! + t.amount);
      settled.set(t.to, settled.get(t.to)! - t.amount);
    }
    for (const [id, amount] of settled) {
      assert.equal(amount, 0, `lần ${iteration}: ${id} còn lệch ${amount}`);
    }
  }
});
