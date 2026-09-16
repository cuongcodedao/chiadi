import "server-only";

import { and, desc, eq, inArray, isNull } from "drizzle-orm";

import { db } from "./client";
import {
  activities,
  expensePayers,
  expenseShares,
  expenses,
  groups,
  members,
  settlements,
} from "./schema";
import {
  computeBalances,
  minimizeTransfers,
  type Balance,
  type Expense,
  type MemberId,
  type Money,
  type Transfer,
} from "@/lib/split";

/**
 * Phía đọc. app/actions.ts chỉ ghi — mọi export trong file "use server" đều
 * thành endpoint, nên hàm đọc không được để lẫn vào đó.
 */

export type GroupMember = {
  id: string;
  name: string;
  /** Ai có link là thành viên — thông tin nhận tiền hiện cho cả nhóm, đúng như màn 9 nói. */
  bank: { code: string; account: string; holder: string } | null;
};

export type GroupExpense = {
  id: string;
  title: string;
  total: Money;
  splitMode: "equal" | "manual" | "units";
  spentAt: string;
  payerIds: MemberId[];
  shareCount: number;
  payers: Record<MemberId, Money>;
  shares: Record<MemberId, Money>;
  /** Số suất đã gõ, chỉ có khi splitMode = "units". */
  units: Record<MemberId, number> | null;
};

/** Một lần bấm "Đã chuyển" — giữ id để gỡ lại được khi bấm nhầm. */
export type GroupSettlement = {
  id: string;
  from: string;
  to: string;
  amount: number;
  createdAt: string;
};

export type GroupData = {
  slug: string;
  name: string;
  members: GroupMember[];
  expenses: GroupExpense[];
  balances: Balance[];
  transfers: Transfer[];
  settlements: GroupSettlement[];
  /** Lỗi bất biến, nếu có — giao diện phải nói thật chứ không âm thầm hiện số sai. */
  balanceError: string | null;
};

function groupRows<T extends { expenseId: string; memberId: string; amount: number }>(
  rows: T[],
): Map<string, Record<MemberId, Money>> {
  const byExpense = new Map<string, Record<MemberId, Money>>();
  for (const row of rows) {
    const bucket = byExpense.get(row.expenseId) ?? {};
    bucket[row.memberId] = row.amount;
    byExpense.set(row.expenseId, bucket);
  }
  return byExpense;
}

export async function loadGroup(slug: string): Promise<GroupData | null> {
  const [group] = await db
    .select({ id: groups.id, slug: groups.slug, name: groups.name })
    .from(groups)
    .where(eq(groups.slug, slug))
    .limit(1);

  if (!group) return null;

  const memberRows = await db
    .select()
    .from(members)
    .where(eq(members.groupId, group.id))
    .orderBy(members.sortOrder);

  const expenseRows = await db
    .select()
    .from(expenses)
    .where(and(eq(expenses.groupId, group.id), isNull(expenses.deletedAt)))
    .orderBy(desc(expenses.spentAt));

  const expenseIds = expenseRows.map((e) => e.id);

  const [payerRows, shareRows, settlementRows] = await Promise.all([
    expenseIds.length
      ? db.select().from(expensePayers).where(inArray(expensePayers.expenseId, expenseIds))
      : Promise.resolve([]),
    expenseIds.length
      ? db.select().from(expenseShares).where(inArray(expenseShares.expenseId, expenseIds))
      : Promise.resolve([]),
    db
      .select()
      .from(settlements)
      .where(and(eq(settlements.groupId, group.id), isNull(settlements.deletedAt))),
  ]);

  const payersByExpense = groupRows(payerRows);
  const sharesByExpense = groupRows(shareRows);

  // Số suất lưu cùng dòng chia tiền — có thì mở khoản chi ra sửa vẫn là "theo suất".
  const unitsByExpense = new Map<string, Record<MemberId, number>>();
  for (const row of shareRows) {
    if (row.units === null) continue;
    const bucket = unitsByExpense.get(row.expenseId) ?? {};
    bucket[row.memberId] = row.units;
    unitsByExpense.set(row.expenseId, bucket);
  }

  const built: Expense[] = expenseRows.map((e) => ({
    id: e.id,
    total: e.total,
    payers: payersByExpense.get(e.id) ?? {},
    shares: sharesByExpense.get(e.id) ?? {},
  }));

  const memberIds = memberRows.map((m) => m.id);

  let balances: Balance[] = [];
  let transfers: Transfer[] = [];
  let balanceError: string | null = null;
  try {
    balances = computeBalances(
      built,
      settlementRows.map((s) => ({
        from: s.fromMember,
        to: s.toMember,
        amount: s.amount,
      })),
      memberIds,
    );
    transfers = minimizeTransfers(balances);
  } catch (error) {
    balanceError =
      error instanceof Error ? error.message : "Không tính được số dư của nhóm";
    balances = memberIds.map((id) => ({ memberId: id, amount: 0 }));
  }

  return {
    slug: group.slug,
    name: group.name,
    members: memberRows.map((m) => ({
      id: m.id,
      name: m.name,
      bank:
        m.bankCode && m.bankAccount && m.bankHolder
          ? { code: m.bankCode, account: m.bankAccount, holder: m.bankHolder }
          : null,
    })),
    expenses: expenseRows.map((e) => ({
      id: e.id,
      title: e.title,
      total: e.total,
      splitMode: e.splitMode,
      spentAt: e.spentAt.toISOString(),
      payerIds: Object.keys(payersByExpense.get(e.id) ?? {}),
      shareCount: Object.keys(sharesByExpense.get(e.id) ?? {}).length,
      payers: payersByExpense.get(e.id) ?? {},
      shares: sharesByExpense.get(e.id) ?? {},
      units: unitsByExpense.get(e.id) ?? null,
    })),
    balances,
    transfers,
    settlements: settlementRows
      .map((s) => ({
        id: s.id,
        from: s.fromMember,
        to: s.toMember,
        amount: s.amount,
        createdAt: s.createdAt.toISOString(),
      }))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    balanceError,
  };
}

export type ActivityEntry = {
  id: string;
  actorId: string | null;
  actorName: string | null;
  kind: string;
  summary: string;
  createdAt: string;
};

export async function loadActivities(slug: string): Promise<ActivityEntry[] | null> {
  const [group] = await db
    .select({ id: groups.id })
    .from(groups)
    .where(eq(groups.slug, slug))
    .limit(1);
  if (!group) return null;

  const rows = await db
    .select()
    .from(activities)
    .where(eq(activities.groupId, group.id))
    .orderBy(desc(activities.createdAt))
    .limit(200);

  return rows.map((r) => ({
    id: r.id,
    actorId: r.actorId,
    actorName: r.actorName,
    kind: r.kind,
    summary: r.summary,
    createdAt: r.createdAt.toISOString(),
  }));
}

/**
 * Kiểm nhóm có tồn tại không, bằng đúng một lần tra chỉ mục duy nhất trên slug.
 *
 * Trang gọi hàm này TRƯỚC khi mở Suspense: notFound() phải chạy xong trước khi
 * byte đầu tiên rời server, nếu không slug sai sẽ trả về 200 kèm nội dung 404.
 */
export async function groupExists(slug: string): Promise<boolean> {
  const [row] = await db
    .select({ id: groups.id })
    .from(groups)
    .where(eq(groups.slug, slug))
    .limit(1);
  return !!row;
}
