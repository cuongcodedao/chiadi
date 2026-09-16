"use server";

import { and, eq, inArray, isNull, or } from "drizzle-orm";
import { customAlphabet } from "nanoid";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/db/client";
import {
  activities,
  expensePayers,
  expenseShares,
  expenses,
  groups,
  members,
  settlements,
  type ActivityKind,
  type Member,
} from "@/db/schema";
import { RATE_LIMITS, checkRateLimit } from "@/lib/rate-limit";
import {
  formatVnd,
  splitByUnits,
  splitEqual,
  validateExpense,
  type MemberId,
  type Money,
} from "@/lib/split";

/**
 * Toàn bộ Server Actions của ChiaDi.
 *
 * Quy ước: không action nào ném lỗi ra ngoài. Mọi thứ trả về ActionResult để
 * giao diện hiện đúng câu tiếng Việt ngay tại chỗ, thay vì nổ ra màn hình lỗi.
 *
 * actorId do client gửi và server KHÔNG xác minh được — đó là cái giá của việc
 * bỏ đăng nhập, chấp nhận được với nhóm bạn bè. Server chỉ kiểm được actorId
 * có thuộc đúng nhóm này không. Bù lại bằng cách ghi mọi thao tác vào activities.
 */

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };

function fail(error: string): { ok: false; error: string } {
  return { ok: false, error };
}

function done<T>(data: T): { ok: true; data: T } {
  return { ok: true, data };
}

// ---------------------------------------------------------------- slug

// Bỏ 0/1/i/l/o để không ai đọc nhầm khi chép tay qua điện thoại.
const SLUG_ALPHABET = "23456789abcdefghjkmnpqrstuvwxyz";
// Slug chính là mật khẩu: 12 ký tự ≈ 59 bit, không đoán được kể cả khi
// rate limit bị vượt qua.
const makeSlug = customAlphabet(SLUG_ALPHABET, 12);

// ---------------------------------------------------------------- schema

const trimmed = z.string().trim();

const personName = trimmed
  .min(1, "Tên không được để trống")
  .max(40, "Tên dài quá 40 ký tự");

const slugSchema = trimmed.min(1, "Thiếu mã nhóm");
const memberIdSchema = z.uuid("Không xác định được thành viên");

const moneySchema = z
  .number()
  .int("Số tiền phải là số nguyên đồng")
  .max(Number.MAX_SAFE_INTEGER, "Số tiền lớn quá mức cho phép");

const positiveMoney = moneySchema.positive("Số tiền phải lớn hơn 0");
const nonNegativeMoney = moneySchema.min(0, "Số tiền không được âm");

const createGroupSchema = z.object({
  name: trimmed
    .min(1, "Tên nhóm không được để trống")
    .max(60, "Tên nhóm dài quá 60 ký tự"),
  memberNames: z
    .array(personName)
    .min(1, "Thêm ít nhất một người vào nhóm")
    .max(50, "Nhóm tối đa 50 người"),
});

const splitSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("equal"),
    participants: z
      .array(memberIdSchema)
      .min(1, "Chọn ít nhất một người để chia"),
  }),
  z.object({
    mode: z.literal("units"),
    units: z.record(
      memberIdSchema,
      z.number().int("Số suất phải là số nguyên").min(0).max(100, "Tối đa 100 suất"),
    ),
  }),
  z.object({
    mode: z.literal("manual"),
    shares: z.record(memberIdSchema, nonNegativeMoney),
  }),
]);

const expenseBodySchema = z.object({
  title: trimmed
    .min(1, "Khoản chi cần có tên")
    .max(80, "Tên khoản chi dài quá 80 ký tự"),
  total: positiveMoney,
  payers: z.record(memberIdSchema, positiveMoney),
  split: splitSchema,
  spentAt: z.coerce.date().optional(),
});

const addExpenseSchema = z.object({
  slug: slugSchema,
  actorId: memberIdSchema,
  expense: expenseBodySchema,
});

const editExpenseSchema = addExpenseSchema.extend({
  expenseId: z.uuid("Không xác định được khoản chi"),
});

const bankInfoSchema = z.object({
  slug: slugSchema,
  actorId: memberIdSchema,
  memberId: memberIdSchema,
  bankCode: trimmed.min(1, "Chọn ngân hàng").max(30),
  bankAccount: trimmed
    .min(4, "Số tài khoản quá ngắn")
    .max(30, "Số tài khoản quá dài")
    .regex(/^[0-9]+$/, "Số tài khoản chỉ gồm chữ số"),
  bankHolder: trimmed
    .min(2, "Nhập tên chủ tài khoản")
    .max(60, "Tên chủ tài khoản dài quá 60 ký tự"),
});

// ---------------------------------------------------------------- helpers

type GroupContext = {
  group: { id: string; slug: string; name: string };
  memberList: Member[];
  /** Thứ tự cố định, dùng cho phần lẻ khi chia không hết. */
  order: MemberId[];
  actor: Member;
};

/**
 * Nạp nhóm theo slug và kiểm actorId có thuộc nhóm đó không.
 * Không xác minh được người gửi *là* actor đó — chỉ chặn được id lạc nhóm khác.
 */
async function loadContext(
  slug: string,
  actorId: string,
): Promise<GroupContext | { error: string }> {
  const [group] = await db
    .select({ id: groups.id, slug: groups.slug, name: groups.name })
    .from(groups)
    .where(eq(groups.slug, slug))
    .limit(1);

  if (!group) return { error: "Nhóm này không tồn tại hoặc link đã hỏng" };

  const memberList = await db
    .select()
    .from(members)
    .where(eq(members.groupId, group.id))
    .orderBy(members.sortOrder);

  const actor = memberList.find((m) => m.id === actorId);
  if (!actor) return { error: "Bạn chưa chọn tên mình trong nhóm này" };

  return { group, memberList, order: memberList.map((m) => m.id), actor };
}

function isError(value: unknown): value is { error: string } {
  return typeof value === "object" && value !== null && "error" in value;
}

/** Câu lỗi đầu tiên của Zod, đã là tiếng Việt sẵn. */
function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Dữ liệu không hợp lệ";
}

/** Sắp id theo thứ tự thành viên trong nhóm — quyết định ai chịu đồng lẻ. */
function inGroupOrder(ids: Iterable<MemberId>, order: MemberId[]): MemberId[] {
  const wanted = new Set(ids);
  return order.filter((id) => wanted.has(id));
}

/**
 * Server tự tính phần chia, không tin con số client gửi lên — trừ chế độ
 * nhập tay, nơi chính người dùng quyết từng đồng (và vẫn bị validateExpense kiểm).
 */
function resolveShares(
  total: Money,
  split: z.infer<typeof splitSchema>,
  order: MemberId[],
): Record<MemberId, Money> {
  switch (split.mode) {
    case "equal":
      return splitEqual(total, inGroupOrder(split.participants, order));
    case "units":
      return splitByUnits(
        total,
        split.units,
        inGroupOrder(Object.keys(split.units), order),
      );
    case "manual":
      return split.shares;
  }
}

/**
 * Số suất chỉ có nghĩa ở chế độ chia theo suất. Lưu lại để mở khoản chi ra sửa
 * thì thấy đúng số suất đã gõ, thay vì rơi về nhập tay.
 */
function unitsOf(
  split: z.infer<typeof splitSchema>,
  memberId: MemberId,
): number | null {
  return split.mode === "units" ? (split.units[memberId] ?? 0) : null;
}

/** Mọi id trong payers/shares phải là thành viên của đúng nhóm này. */
function unknownMember(
  ids: Iterable<MemberId>,
  order: MemberId[],
): string | null {
  const known = new Set(order);
  for (const id of ids) {
    if (!known.has(id)) return "Có người không thuộc nhóm này trong khoản chi";
  }
  return null;
}

type ActivityInput = {
  groupId: string;
  actor: Member | null;
  kind: ActivityKind;
  summary: string;
  before?: unknown;
  after?: unknown;
};

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

function recordActivity(tx: Tx, input: ActivityInput) {
  return tx.insert(activities).values({
    groupId: input.groupId,
    actorId: input.actor?.id ?? null,
    actorName: input.actor?.name ?? null,
    kind: input.kind,
    summary: input.summary,
    before: input.before ?? null,
    after: input.after ?? null,
  });
}

/**
 * assert_expense_balanced chạy lúc commit nên lỗi của nó bật ra ở đây.
 * Về lý thì validateExpense đã chặn từ trước — đây là lưới an toàn cuối.
 */
function describeDbError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("lệch")) {
    return "Số tiền trong khoản chi không khớp nhau, thử nhập lại";
  }
  console.error("[chiadi] lỗi database:", error);
  return "Không lưu được, thử lại giúp mình";
}

function refresh(slug: string) {
  revalidatePath(`/g/${slug}`);
  revalidatePath(`/g/${slug}/history`);
}

// ---------------------------------------------------------------- actions

export async function createGroup(
  input: z.input<typeof createGroupSchema>,
): Promise<ActionResult<{ slug: string; memberIds: string[] }>> {
  if (!(await checkRateLimit(RATE_LIMITS.createGroup))) {
    return fail("Bạn vừa tạo khá nhiều nhóm, thử lại sau một lát");
  }

  const parsed = createGroupSchema.safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error));

  const { name, memberNames } = parsed.data;
  const slug = makeSlug();

  try {
    const memberIds = await db.transaction(async (tx) => {
      const [group] = await tx
        .insert(groups)
        .values({ slug, name })
        .returning({ id: groups.id });

      const inserted = await tx
        .insert(members)
        .values(
          memberNames.map((memberName, index) => ({
            groupId: group.id,
            name: memberName,
            sortOrder: index,
          })),
        )
        .returning({ id: members.id });

      await recordActivity(tx, {
        groupId: group.id,
        actor: null,
        kind: "group_created",
        summary: `tạo nhóm ${name}`,
        after: { name, memberNames },
      });

      return inserted.map((m) => m.id);
    });

    return done({ slug, memberIds });
  } catch (error) {
    return fail(describeDbError(error));
  }
}

/** Sửa tên nhóm. Gõ nhầm lúc tạo thì phải sửa được, không phải tạo nhóm mới. */
export async function renameGroup(
  input: { slug: string; actorId: string; name: string },
): Promise<ActionResult> {
  if (!(await checkRateLimit(RATE_LIMITS.write))) {
    return fail("Thao tác hơi nhanh, chờ một chút rồi thử lại");
  }

  const parsed = z
    .object({
      slug: slugSchema,
      actorId: memberIdSchema,
      name: trimmed
        .min(1, "Tên nhóm không được để trống")
        .max(60, "Tên nhóm dài quá 60 ký tự"),
    })
    .safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error));

  const context = await loadContext(parsed.data.slug, parsed.data.actorId);
  if (isError(context)) return fail(context.error);
  if (context.group.name === parsed.data.name) return done(undefined);

  try {
    await db.transaction(async (tx) => {
      await tx
        .update(groups)
        .set({ name: parsed.data.name })
        .where(eq(groups.id, context.group.id));

      await recordActivity(tx, {
        groupId: context.group.id,
        actor: context.actor,
        kind: "group_renamed",
        summary: `đổi tên nhóm từ ${context.group.name} thành ${parsed.data.name}`,
        before: { name: context.group.name },
        after: { name: parsed.data.name },
      });
    });

    refresh(parsed.data.slug);
    return done(undefined);
  } catch (error) {
    return fail(describeDbError(error));
  }
}

/** Sửa tên một thành viên. Lịch sử cũ giữ nguyên tên lúc đó, đúng như đã ghi. */
export async function renameMember(
  input: { slug: string; actorId: string; memberId: string; name: string },
): Promise<ActionResult> {
  if (!(await checkRateLimit(RATE_LIMITS.write))) {
    return fail("Thao tác hơi nhanh, chờ một chút rồi thử lại");
  }

  const parsed = z
    .object({
      slug: slugSchema,
      actorId: memberIdSchema,
      memberId: memberIdSchema,
      name: personName,
    })
    .safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error));

  const context = await loadContext(parsed.data.slug, parsed.data.actorId);
  if (isError(context)) return fail(context.error);

  const target = context.memberList.find((m) => m.id === parsed.data.memberId);
  if (!target) return fail("Người này không thuộc nhóm");
  if (target.name === parsed.data.name) return done(undefined);

  try {
    await db.transaction(async (tx) => {
      await tx
        .update(members)
        .set({ name: parsed.data.name })
        .where(eq(members.id, target.id));

      await recordActivity(tx, {
        groupId: context.group.id,
        actor: context.actor,
        kind: "member_renamed",
        summary: `đổi tên ${target.name} thành ${parsed.data.name}`,
        before: { name: target.name },
        after: { name: parsed.data.name },
      });
    });

    refresh(parsed.data.slug);
    return done(undefined);
  } catch (error) {
    return fail(describeDbError(error));
  }
}

/**
 * Xóa người gõ nhầm khỏi nhóm. Chỉ xóa được khi người đó chưa dính vào đồng nào:
 * xóa người đã có khoản chi là xóa luôn phần chia của họ, và tổng khoản chi sẽ
 * lệch — đúng thứ mà assert_expense_balanced sinh ra để chặn.
 */
export async function removeMember(
  input: { slug: string; actorId: string; memberId: string },
): Promise<ActionResult> {
  if (!(await checkRateLimit(RATE_LIMITS.write))) {
    return fail("Thao tác hơi nhanh, chờ một chút rồi thử lại");
  }

  const parsed = z
    .object({
      slug: slugSchema,
      actorId: memberIdSchema,
      memberId: memberIdSchema,
    })
    .safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error));

  const context = await loadContext(parsed.data.slug, parsed.data.actorId);
  if (isError(context)) return fail(context.error);

  const target = context.memberList.find((m) => m.id === parsed.data.memberId);
  if (!target) return fail("Người này không thuộc nhóm");
  if (context.memberList.length <= 1) return fail("Nhóm phải còn ít nhất một người");

  const [paid] = await db
    .select({ id: expensePayers.expenseId })
    .from(expensePayers)
    .where(eq(expensePayers.memberId, target.id))
    .limit(1);
  const [shared] = await db
    .select({ id: expenseShares.expenseId })
    .from(expenseShares)
    .where(eq(expenseShares.memberId, target.id))
    .limit(1);
  if (paid || shared) {
    return fail(`${target.name} đã dính vào khoản chi rồi, sửa hoặc xóa khoản đó trước`);
  }

  const [moved] = await db
    .select({ id: settlements.id })
    .from(settlements)
    .where(
      and(
        or(eq(settlements.fromMember, target.id), eq(settlements.toMember, target.id)),
        isNull(settlements.deletedAt),
      ),
    )
    .limit(1);
  if (moved) return fail(`${target.name} đã có lần chuyển tiền được ghi lại`);

  try {
    await db.transaction(async (tx) => {
      await tx.delete(members).where(eq(members.id, target.id));

      await recordActivity(tx, {
        groupId: context.group.id,
        actor: context.actor,
        kind: "member_removed",
        summary: `xóa ${target.name} khỏi nhóm`,
        before: { name: target.name },
      });
    });

    refresh(parsed.data.slug);
    return done(undefined);
  } catch (error) {
    return fail(describeDbError(error));
  }
}

/** Thêm người vào nhóm sau khi đã tạo — màn 2, "Tên tôi chưa có trong danh sách". */
export async function addMember(
  input: { slug: string; name: string; actorId?: string },
): Promise<ActionResult<{ memberId: string }>> {
  if (!(await checkRateLimit(RATE_LIMITS.write))) {
    return fail("Thao tác hơi nhanh, chờ một chút rồi thử lại");
  }

  const parsed = z
    .object({
      slug: slugSchema,
      name: personName,
      actorId: memberIdSchema.optional(),
    })
    .safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error));

  const [group] = await db
    .select({ id: groups.id })
    .from(groups)
    .where(eq(groups.slug, parsed.data.slug))
    .limit(1);
  if (!group) return fail("Nhóm này không tồn tại hoặc link đã hỏng");

  try {
    const memberId = await db.transaction(async (tx) => {
      const existing = await tx
        .select({ id: members.id, sortOrder: members.sortOrder })
        .from(members)
        .where(eq(members.groupId, group.id));

      const nextOrder =
        existing.reduce((max, m) => Math.max(max, m.sortOrder), -1) + 1;

      const [created] = await tx
        .insert(members)
        .values({ groupId: group.id, name: parsed.data.name, sortOrder: nextOrder })
        .returning({ id: members.id, name: members.name });

      await recordActivity(tx, {
        groupId: group.id,
        actor: { id: created.id, name: created.name } as Member,
        kind: "member_joined",
        summary: "tham gia nhóm",
      });

      return created.id;
    });

    refresh(parsed.data.slug);
    return done({ memberId });
  } catch (error) {
    return fail(describeDbError(error));
  }
}

export async function addExpense(
  input: z.input<typeof addExpenseSchema>,
): Promise<ActionResult<{ expenseId: string }>> {
  if (!(await checkRateLimit(RATE_LIMITS.write))) {
    return fail("Thao tác hơi nhanh, chờ một chút rồi thử lại");
  }

  const parsed = addExpenseSchema.safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error));

  const context = await loadContext(parsed.data.slug, parsed.data.actorId);
  if (isError(context)) return fail(context.error);

  const body = parsed.data.expense;
  const participantIds =
    body.split.mode === "equal"
      ? body.split.participants
      : Object.keys(body.split.mode === "units" ? body.split.units : body.split.shares);

  const stranger =
    unknownMember(Object.keys(body.payers), context.order) ??
    unknownMember(participantIds, context.order);
  if (stranger) return fail(stranger);

  let shares: Record<MemberId, Money>;
  try {
    shares = resolveShares(body.total, body.split, context.order);
    validateExpense({
      id: "new",
      total: body.total,
      payers: body.payers,
      shares,
    });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Số tiền không hợp lệ");
  }

  try {
    const expenseId = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(expenses)
        .values({
          groupId: context.group.id,
          title: body.title,
          total: body.total,
          splitMode: body.split.mode,
          createdBy: context.actor.id,
          ...(body.spentAt ? { spentAt: body.spentAt } : {}),
        })
        .returning({ id: expenses.id });

      await tx.insert(expensePayers).values(
        Object.entries(body.payers).map(([memberId, amount]) => ({
          expenseId: created.id,
          memberId,
          amount,
        })),
      );

      await tx.insert(expenseShares).values(
        Object.entries(shares).map(([memberId, amount]) => ({
          expenseId: created.id,
          memberId,
          amount,
          units: unitsOf(body.split, memberId),
        })),
      );

      await recordActivity(tx, {
        groupId: context.group.id,
        actor: context.actor,
        kind: "expense_added",
        summary: `thêm khoản ${body.title} · ${formatVnd(body.total)}`,
        after: { title: body.title, total: body.total },
      });

      return created.id;
    });

    refresh(parsed.data.slug);
    return done({ expenseId });
  } catch (error) {
    return fail(describeDbError(error));
  }
}

export async function editExpense(
  input: z.input<typeof editExpenseSchema>,
): Promise<ActionResult> {
  if (!(await checkRateLimit(RATE_LIMITS.write))) {
    return fail("Thao tác hơi nhanh, chờ một chút rồi thử lại");
  }

  const parsed = editExpenseSchema.safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error));

  const context = await loadContext(parsed.data.slug, parsed.data.actorId);
  if (isError(context)) return fail(context.error);

  const [current] = await db
    .select()
    .from(expenses)
    .where(
      and(
        eq(expenses.id, parsed.data.expenseId),
        eq(expenses.groupId, context.group.id),
        isNull(expenses.deletedAt),
      ),
    )
    .limit(1);
  if (!current) return fail("Khoản chi này không còn nữa");

  const body = parsed.data.expense;
  const participantIds =
    body.split.mode === "equal"
      ? body.split.participants
      : Object.keys(body.split.mode === "units" ? body.split.units : body.split.shares);

  const stranger =
    unknownMember(Object.keys(body.payers), context.order) ??
    unknownMember(participantIds, context.order);
  if (stranger) return fail(stranger);

  let shares: Record<MemberId, Money>;
  try {
    shares = resolveShares(body.total, body.split, context.order);
    validateExpense({
      id: current.id,
      total: body.total,
      payers: body.payers,
      shares,
    });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Số tiền không hợp lệ");
  }

  try {
    await db.transaction(async (tx) => {
      // Thay sạch payers và shares trong cùng transaction — trigger cân bằng
      // là DEFERRABLE nên nó chỉ soi kết quả cuối lúc commit.
      await tx.delete(expensePayers).where(eq(expensePayers.expenseId, current.id));
      await tx.delete(expenseShares).where(eq(expenseShares.expenseId, current.id));

      await tx
        .update(expenses)
        .set({
          title: body.title,
          total: body.total,
          splitMode: body.split.mode,
          updatedAt: new Date(),
          ...(body.spentAt ? { spentAt: body.spentAt } : {}),
        })
        .where(eq(expenses.id, current.id));

      await tx.insert(expensePayers).values(
        Object.entries(body.payers).map(([memberId, amount]) => ({
          expenseId: current.id,
          memberId,
          amount,
        })),
      );

      await tx.insert(expenseShares).values(
        Object.entries(shares).map(([memberId, amount]) => ({
          expenseId: current.id,
          memberId,
          amount,
          units: unitsOf(body.split, memberId),
        })),
      );

      // Ghi cả giá trị cũ và mới — đây là thứ dập tắt tranh cãi.
      const summary =
        current.total === body.total
          ? `sửa khoản ${current.title}`
          : `sửa ${current.title} từ ${formatVnd(current.total)} thành ${formatVnd(body.total)}`;

      await recordActivity(tx, {
        groupId: context.group.id,
        actor: context.actor,
        kind: "expense_edited",
        summary,
        before: { title: current.title, total: current.total },
        after: { title: body.title, total: body.total },
      });
    });

    refresh(parsed.data.slug);
    return done(undefined);
  } catch (error) {
    return fail(describeDbError(error));
  }
}

export async function deleteExpense(
  input: { slug: string; actorId: string; expenseId: string },
): Promise<ActionResult> {
  if (!(await checkRateLimit(RATE_LIMITS.write))) {
    return fail("Thao tác hơi nhanh, chờ một chút rồi thử lại");
  }

  const parsed = z
    .object({
      slug: slugSchema,
      actorId: memberIdSchema,
      expenseId: z.uuid("Không xác định được khoản chi"),
    })
    .safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error));

  const context = await loadContext(parsed.data.slug, parsed.data.actorId);
  if (isError(context)) return fail(context.error);

  const [current] = await db
    .select({ id: expenses.id, title: expenses.title, total: expenses.total })
    .from(expenses)
    .where(
      and(
        eq(expenses.id, parsed.data.expenseId),
        eq(expenses.groupId, context.group.id),
        isNull(expenses.deletedAt),
      ),
    )
    .limit(1);
  if (!current) return fail("Khoản chi này không còn nữa");

  try {
    await db.transaction(async (tx) => {
      // Xóa mềm: giữ nguyên payers và shares nên trigger cân bằng không đụng tới.
      await tx
        .update(expenses)
        .set({ deletedAt: new Date(), updatedAt: new Date() })
        .where(eq(expenses.id, current.id));

      await recordActivity(tx, {
        groupId: context.group.id,
        actor: context.actor,
        kind: "expense_deleted",
        summary: `xóa khoản ${current.title} · ${formatVnd(current.total)}`,
        before: { title: current.title, total: current.total },
      });
    });

    refresh(parsed.data.slug);
    return done(undefined);
  } catch (error) {
    return fail(describeDbError(error));
  }
}

/** "Đã chuyển" ở màn 3 và màn 8. */
export async function markSettled(
  input: { slug: string; actorId: string; toMemberId: string; amount: number },
): Promise<ActionResult<{ settlementId: string }>> {
  if (!(await checkRateLimit(RATE_LIMITS.write))) {
    return fail("Thao tác hơi nhanh, chờ một chút rồi thử lại");
  }

  const parsed = z
    .object({
      slug: slugSchema,
      actorId: memberIdSchema,
      toMemberId: memberIdSchema,
      amount: positiveMoney,
    })
    .safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error));

  const context = await loadContext(parsed.data.slug, parsed.data.actorId);
  if (isError(context)) return fail(context.error);

  if (parsed.data.toMemberId === parsed.data.actorId) {
    return fail("Không thể tự chuyển cho chính mình");
  }

  const receiver = context.memberList.find((m) => m.id === parsed.data.toMemberId);
  if (!receiver) return fail("Người nhận không thuộc nhóm này");

  try {
    const settlementId = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(settlements)
        .values({
          groupId: context.group.id,
          fromMember: context.actor.id,
          toMember: receiver.id,
          amount: parsed.data.amount,
        })
        .returning({ id: settlements.id });

      await recordActivity(tx, {
        groupId: context.group.id,
        actor: context.actor,
        kind: "settled",
        summary: `đánh dấu đã chuyển ${formatVnd(parsed.data.amount)} cho ${receiver.name}`,
        after: { to: receiver.name, amount: parsed.data.amount },
      });

      return created.id;
    });

    refresh(parsed.data.slug);
    return done({ settlementId });
  } catch (error) {
    return fail(describeDbError(error));
  }
}

/** Bấm nhầm "Đã chuyển" là ghi sai số dư, nên phải gỡ lại được. */
export async function undoSettlement(
  input: { slug: string; actorId: string; settlementId: string },
): Promise<ActionResult> {
  if (!(await checkRateLimit(RATE_LIMITS.write))) {
    return fail("Thao tác hơi nhanh, chờ một chút rồi thử lại");
  }

  const parsed = z
    .object({
      slug: slugSchema,
      actorId: memberIdSchema,
      settlementId: z.uuid("Không xác định được lần chuyển"),
    })
    .safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error));

  const context = await loadContext(parsed.data.slug, parsed.data.actorId);
  if (isError(context)) return fail(context.error);

  const [current] = await db
    .select()
    .from(settlements)
    .where(
      and(
        eq(settlements.id, parsed.data.settlementId),
        eq(settlements.groupId, context.group.id),
        isNull(settlements.deletedAt),
      ),
    )
    .limit(1);
  if (!current) return fail("Lần chuyển này không còn nữa");

  const receiver = context.memberList.find((m) => m.id === current.toMember);

  try {
    await db.transaction(async (tx) => {
      await tx
        .update(settlements)
        .set({ deletedAt: new Date() })
        .where(eq(settlements.id, current.id));

      await recordActivity(tx, {
        groupId: context.group.id,
        actor: context.actor,
        kind: "settle_undone",
        summary: `gỡ đánh dấu đã chuyển ${formatVnd(current.amount)} cho ${receiver?.name ?? "một người"}`,
        before: { to: receiver?.name ?? null, amount: current.amount },
      });
    });

    refresh(parsed.data.slug);
    return done(undefined);
  } catch (error) {
    return fail(describeDbError(error));
  }
}

/** Màn 9 — tài khoản nhận tiền, chỉ thành viên trong nhóm nhìn thấy. */
export async function saveBankInfo(
  input: z.input<typeof bankInfoSchema>,
): Promise<ActionResult> {
  if (!(await checkRateLimit(RATE_LIMITS.write))) {
    return fail("Thao tác hơi nhanh, chờ một chút rồi thử lại");
  }

  const parsed = bankInfoSchema.safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error));

  const context = await loadContext(parsed.data.slug, parsed.data.actorId);
  if (isError(context)) return fail(context.error);

  const target = context.memberList.find((m) => m.id === parsed.data.memberId);
  if (!target) return fail("Người này không thuộc nhóm này");

  try {
    await db.transaction(async (tx) => {
      await tx
        .update(members)
        .set({
          bankCode: parsed.data.bankCode,
          bankAccount: parsed.data.bankAccount,
          bankHolder: parsed.data.bankHolder,
        })
        .where(eq(members.id, target.id));

      await recordActivity(tx, {
        groupId: context.group.id,
        actor: context.actor,
        kind: "bank_saved",
        summary:
          target.id === context.actor.id
            ? "cập nhật tài khoản nhận tiền"
            : `cập nhật tài khoản nhận tiền của ${target.name}`,
      });
    });

    refresh(parsed.data.slug);
    return done(undefined);
  } catch (error) {
    return fail(describeDbError(error));
  }
}

/**
 * Ghi nhận người vừa chọn tên mình ở màn 2. Chỉ số thành công của sản phẩm là
 * tỷ lệ nhóm có từ 3 người trở lên cùng nhập liệu, nên việc này đáng được ghi lại.
 */
export async function claimMember(
  input: { slug: string; memberId: string },
): Promise<ActionResult> {
  if (!(await checkRateLimit(RATE_LIMITS.write))) return done(undefined);

  const parsed = z
    .object({ slug: slugSchema, memberId: memberIdSchema })
    .safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error));

  const context = await loadContext(parsed.data.slug, parsed.data.memberId);
  if (isError(context)) return fail(context.error);

  const [seen] = await db
    .select({ id: activities.id })
    .from(activities)
    .where(
      and(
        eq(activities.groupId, context.group.id),
        eq(activities.actorId, context.actor.id),
        inArray(activities.kind, ["member_joined"]),
      ),
    )
    .limit(1);

  // Chỉ ghi lần đầu — mở lại link không phải là tham gia lại.
  if (seen) return done(undefined);

  try {
    await db.transaction(async (tx) => {
      await recordActivity(tx, {
        groupId: context.group.id,
        actor: context.actor,
        kind: "member_joined",
        summary: "tham gia nhóm",
      });
    });
    refresh(parsed.data.slug);
    return done(undefined);
  } catch (error) {
    return fail(describeDbError(error));
  }
}
