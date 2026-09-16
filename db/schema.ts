/**
 * Bản soi của db/schema.sql cho Drizzle.
 *
 * `db/schema.sql` mới là nguồn chuẩn — lược đồ được tạo bằng
 * `psql $DATABASE_URL -f db/schema.sql`. File này chỉ để truy vấn có kiểu.
 * Sửa một bên thì phải sửa bên kia.
 *
 * Mọi cột tiền là bigint đơn vị đồng, đọc ra dưới dạng `number`: giá trị lớn
 * nhất có thể gặp còn cách Number.MAX_SAFE_INTEGER rất xa, và lib/split.ts
 * làm việc trên number.
 */
import {
  bigint,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

const money = (name: string) => bigint(name, { mode: "number" });

export const groups = pgTable("groups", {
  id: uuid("id").primaryKey().defaultRandom(),
  /** Slug chính là mật khẩu — không bao giờ liệt kê cột này ra ngoài. */
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const members = pgTable(
  "members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    /** Thứ tự cố định — quyết định ai chịu đồng lẻ khi chia không hết. */
    sortOrder: integer("sort_order").notNull(),

    bankCode: text("bank_code"),
    bankAccount: text("bank_account"),
    bankHolder: text("bank_holder"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("members_group_idx").on(t.groupId, t.sortOrder)],
);

export const expenses = pgTable(
  "expenses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    total: money("total").notNull(),
    splitMode: text("split_mode", {
      enum: ["equal", "manual", "units"],
    }).notNull(),
    /** Do client gửi, server không xác minh được. Xem activities. */
    createdBy: uuid("created_by").references(() => members.id, {
      onDelete: "set null",
    }),
    spentAt: timestamp("spent_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    /** Xóa mềm — luôn lọc `isNull(expenses.deletedAt)` trước khi tính số dư. */
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [index("expenses_group_idx").on(t.groupId, t.spentAt)],
);

export const expensePayers = pgTable(
  "expense_payers",
  {
    expenseId: uuid("expense_id")
      .notNull()
      .references(() => expenses.id, { onDelete: "cascade" }),
    memberId: uuid("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    amount: money("amount").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.expenseId, t.memberId] }),
    index("expense_payers_member_idx").on(t.memberId),
  ],
);

/** Số tiền đã tính sẵn, không phải tỷ lệ. Bất biến 3. */
export const expenseShares = pgTable(
  "expense_shares",
  {
    expenseId: uuid("expense_id")
      .notNull()
      .references(() => expenses.id, { onDelete: "cascade" }),
    memberId: uuid("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    amount: money("amount").notNull(),
    /** Chỉ có nghĩa khi splitMode = "units" — tiền vẫn nằm ở amount. */
    units: integer("units"),
  },
  (t) => [
    primaryKey({ columns: [t.expenseId, t.memberId] }),
    index("expense_shares_member_idx").on(t.memberId),
  ],
);

export const settlements = pgTable(
  "settlements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    fromMember: uuid("from_member")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    toMember: uuid("to_member")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    amount: money("amount").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [index("settlements_group_idx").on(t.groupId, t.createdAt)],
);

export const ACTIVITY_KINDS = [
  "group_created",
  "group_renamed",
  "member_added",
  "member_joined",
  "member_renamed",
  "member_removed",
  "expense_added",
  "expense_edited",
  "expense_deleted",
  "settled",
  "settle_undone",
  "bank_saved",
] as const;

export type ActivityKind = (typeof ACTIVITY_KINDS)[number];

export const activities = pgTable(
  "activities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    actorId: uuid("actor_id").references(() => members.id, {
      onDelete: "set null",
    }),
    kind: text("kind", { enum: ACTIVITY_KINDS }).notNull(),
    /** Tên người thao tác, chụp lại lúc ghi. Giao diện thay bằng "Bạn" khi trùng người xem. */
    actorName: text("actor_name"),
    /** Vị ngữ dựng sẵn lúc ghi — không chứa tên người thao tác. */
    summary: text("summary").notNull(),
    before: jsonb("before"),
    after: jsonb("after"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("activities_group_idx").on(t.groupId, t.createdAt)],
);

export type Group = typeof groups.$inferSelect;
export type Member = typeof members.$inferSelect;
export type ExpenseRow = typeof expenses.$inferSelect;
export type ExpensePayerRow = typeof expensePayers.$inferSelect;
export type ExpenseShareRow = typeof expenseShares.$inferSelect;
export type SettlementRow = typeof settlements.$inferSelect;
export type ActivityRow = typeof activities.$inferSelect;
