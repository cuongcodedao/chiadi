"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import type { ActivityEntry } from "@/db/queries";
import { readIdentity } from "@/lib/identity";
import { dayLabel, timeOfDay } from "@/lib/ui";

/**
 * Màn 10 — lịch sử thay đổi.
 * Đây là thứ dập tắt tranh cãi: mỗi dòng nói rõ ai làm gì, lúc nào,
 * và khi có người sửa thì ghi cả giá trị cũ lẫn mới.
 */
const SYMBOL: Record<string, string> = {
  group_created: "⚑",
  group_renamed: "✎",
  member_added: "👤",
  member_joined: "👤",
  member_renamed: "✎",
  member_removed: "✕",
  expense_added: "+",
  expense_edited: "✎",
  expense_deleted: "−",
  settled: "✓",
  settle_undone: "↩",
  bank_saved: "🏦",
};

export function HistoryList({
  slug,
  entries,
}: {
  slug: string;
  entries: ActivityEntry[];
}) {
  const [meId, setMeId] = useState<string | null>(null);
  useEffect(() => setMeId(readIdentity(slug)), [slug]);

  // Đã xếp mới nhất trước từ database; gom theo ngày mà vẫn giữ thứ tự đó.
  const days: { label: string; items: ActivityEntry[] }[] = [];
  for (const entry of entries) {
    const label = dayLabel(entry.createdAt);
    const last = days[days.length - 1];
    if (last?.label === label) last.items.push(entry);
    else days.push({ label, items: [entry] });
  }

  return (
    <main className="reading min-h-dvh">
      <header className="bar justify-start gap-3">
        <Link href={`/g/${slug}`} className="text-[18px]" aria-label="Quay lại nhóm">
          ←
        </Link>
        <span className="gname">Lịch sử thay đổi</span>
      </header>

      <div className="px-4 pt-[6px] pb-[18px]">
        {entries.length === 0 && (
          <p className="t14 m mt16">Chưa có thay đổi nào được ghi lại.</p>
        )}

        {days.map((day) => (
          <div key={day.label}>
            <div className="t12 m mt16">{day.label}</div>
            {day.items.map((entry) => (
              <div key={entry.id} className="act">
                <span
                  className="sym"
                  style={
                    entry.kind === "settled" ? { color: "var(--color-accent)" } : undefined
                  }
                  aria-hidden
                >
                  {SYMBOL[entry.kind] ?? "·"}
                </span>
                <div>
                  <div className="t14 leading-[1.45]">
                    <Actor entry={entry} meId={meId} /> {entry.summary}
                  </div>
                  <div className="t12 m mt4">{timeOfDay(entry.createdAt)}</div>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </main>
  );
}

/**
 * Nhóm được tạo trước khi có ai chọn tên mình, nên dòng đó không có người thao tác.
 */
function Actor({ entry, meId }: { entry: ActivityEntry; meId: string | null }) {
  if (!entry.actorName) return <>Nhóm này được</>;
  if (meId && entry.actorId === meId) return <>Bạn</>;
  return <>{entry.actorName}</>;
}
