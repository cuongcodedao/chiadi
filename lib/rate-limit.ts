import "server-only";

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { headers } from "next/headers";

/**
 * Rate limit theo IP.
 *
 * CLAUDE.md xếp helper VietQR chung file này, nhưng helper đó phải chạy được
 * cả ở phía client để dựng ảnh QR, mà file này là "server-only".
 * Vì vậy VietQR nằm riêng ở lib/vietqr.ts.
 */

// ---------------------------------------------------------------- rate limit

const hasUpstash =
  !!process.env.UPSTASH_REDIS_REST_URL && !!process.env.UPSTASH_REDIS_REST_TOKEN;

/** Bộ đếm trong RAM — chỉ đúng trên một instance, dùng cho máy dev. */
const memoryHits = new Map<string, number[]>();
let warnedAboutMemory = false;

const limiters = new Map<string, Ratelimit>();

function upstashLimiter(name: string, limit: number, window: string) {
  let limiter = limiters.get(name);
  if (!limiter) {
    limiter = new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: Ratelimit.slidingWindow(limit, window as `${number} ${"s" | "m" | "h"}`),
      prefix: `chiadi:${name}`,
      analytics: false,
    });
    limiters.set(name, limiter);
  }
  return limiter;
}

function memoryCheck(key: string, limit: number, windowMs: number): boolean {
  if (!warnedAboutMemory) {
    warnedAboutMemory = true;
    if (process.env.NODE_ENV === "production") {
      console.warn(
        "[chiadi] Thiếu UPSTASH_REDIS_REST_URL/TOKEN — rate limit đang chạy trong RAM " +
          "và chỉ đúng trên một instance. Trên Vercel nhiều instance thì coi như không có.",
      );
    }
  }

  const now = Date.now();
  const hits = (memoryHits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (hits.length >= limit) {
    memoryHits.set(key, hits);
    return false;
  }
  hits.push(now);
  memoryHits.set(key, hits);

  // Dọn rác thưa thôi, bản đồ này chỉ sống trong một tiến trình dev.
  if (memoryHits.size > 5_000) {
    for (const [k, v] of memoryHits) {
      if (v.every((t) => now - t >= windowMs)) memoryHits.delete(k);
    }
  }
  return true;
}

export type RateLimitRule = {
  name: string;
  limit: number;
  /** Dạng Upstash: "1 m", "1 h". */
  window: `${number} ${"s" | "m" | "h"}`;
};

export const RATE_LIMITS = {
  /** Tạo nhóm tốn tài nguyên nhất và là thứ dễ bị spam nhất. */
  createGroup: { name: "create-group", limit: 10, window: "1 h" },
  /** Thao tác ghi thông thường trong một nhóm. */
  write: { name: "write", limit: 60, window: "1 m" },
} as const satisfies Record<string, RateLimitRule>;

function windowToMs(window: string): number {
  const [amount, unit] = window.split(" ");
  const n = Number(amount);
  if (unit.startsWith("s")) return n * 1_000;
  if (unit.startsWith("m")) return n * 60_000;
  return n * 3_600_000;
}

/** IP người gọi, lấy từ header của proxy. Không tin được tuyệt đối, nhưng đủ để chặn spam. */
export async function clientIp(): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return h.get("x-real-ip") ?? "unknown";
}

/**
 * Trả về true nếu được phép đi tiếp.
 * Người gọi tự quyết thông báo gì — hàm này không ném lỗi.
 */
export async function checkRateLimit(rule: RateLimitRule): Promise<boolean> {
  const ip = await clientIp();
  const key = `${rule.name}:${ip}`;

  if (hasUpstash) {
    const { success } = await upstashLimiter(rule.name, rule.limit, rule.window).limit(key);
    return success;
  }
  return memoryCheck(key, rule.limit, windowToMs(rule.window));
}
