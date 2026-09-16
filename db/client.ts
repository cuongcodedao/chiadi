import "server-only";

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "Thiếu DATABASE_URL. Chép .env.example thành .env.local rồi điền chuỗi kết nối Postgres.",
  );
}

// Dev chạy lại module liên tục do hot reload; giữ một kết nối duy nhất trên
// globalThis để không mở hàng trăm connection tới Postgres.
const globalForDb = globalThis as unknown as {
  chiadiSql?: ReturnType<typeof postgres>;
};

/**
 * Neon và Supabase đều có bản "pooled" đứng trước database thật. Ở chế độ gộp
 * theo transaction, prepared statement không sống qua được lần gọi sau —
 * postgres.js phải tắt nó, không thì lúc tải cao sẽ ném lỗi "prepared statement
 * already exists" rời rạc, rất khó lần.
 */
const pooled = /-pooler\.|pooler\.supabase|:6543/.test(connectionString);

const sql =
  globalForDb.chiadiSql ??
  postgres(connectionString, {
    // Vercel serverless: mỗi instance sống ngắn, pool lớn không giúp gì.
    max: process.env.NODE_ENV === "production" ? 1 : 5,
    prepare: !pooled,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.chiadiSql = sql;
}

export const db = drizzle(sql, { schema });
export { sql };
