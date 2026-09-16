// Đẩy db/schema.sql lên database đang trỏ tới bằng DATABASE_URL.
// File DDL viết theo kiểu chạy lại được nhiều lần (create if not exists,
// alter ... add column if not exists), nên chạy nhiều lần không hỏng gì.
//
//   npm run db:push                          # đọc .env.local
//   DATABASE_URL="postgres://…" npm run db:push:remote
import { readFileSync } from "node:fs";
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("Thiếu DATABASE_URL.");
  process.exit(1);
}

const sql = postgres(url, { max: 1, prepare: false, onnotice: () => {} });

try {
  await sql.unsafe(readFileSync(new URL("../db/schema.sql", import.meta.url), "utf8"));

  const [{ tables }] = await sql`
    select count(*)::int as tables
    from information_schema.tables
    where table_schema = 'public'
      and table_name in ('groups', 'members', 'expenses', 'expense_payers',
                         'expense_shares', 'settlements', 'activities')`;

  console.log(
    tables === 7
      ? "Xong. Đủ 7 bảng."
      : `Chạy xong nhưng chỉ thấy ${tables}/7 bảng — xem lại quyền của user.`,
  );
} catch (error) {
  console.error("Không chạy được schema:", error.message);
  process.exitCode = 1;
} finally {
  await sql.end();
}
