"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { type RecentGroup, forgetGroup, readGroups } from "@/lib/identity";

/**
 * Nhóm đã mở trên máy này.
 *
 * Không có tài khoản nên mất link là mất nhóm — đây là đường quay lại duy nhất,
 * và nó chỉ sống trong trình duyệt này. Danh sách trống thì không hiện gì cả,
 * người mới vào không cần biết khối này tồn tại.
 */
export function RecentGroups() {
  const [groups, setGroups] = useState<RecentGroup[]>([]);

  useEffect(() => setGroups(readGroups()), []);

  if (groups.length === 0) return null;

  return (
    <section className="lp">
      <div className="lpin narrow">
        <h2 className="h2">Nhóm bạn đã mở</h2>
        <p className="t14 m mt6">
          Trình duyệt này nhớ giúp. Máy khác thì cần link như cũ.
        </p>

        <div className="mt16">
          {groups.map((group) => (
            <div key={group.slug} className="recent">
              <Link href={`/g/${group.slug}`} className="grow t15 truncate">
                {group.name}
              </Link>
              <button
                className="tap"
                onClick={() => {
                  forgetGroup(group.slug);
                  setGroups(readGroups());
                }}
                aria-label={`Bỏ ${group.name} khỏi danh sách này`}
              >
                Bỏ khỏi danh sách
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
