import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { groupExists, loadGroup } from "@/db/queries";

import { GroupClient } from "./group-client";
import { GroupSkeleton } from "./skeletons";

// Slug chính là mật khẩu — trang nhóm không bao giờ được vào chỉ mục.
// app/robots.ts chặn thêm một lớp nữa ở /robots.txt.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function GroupPage({ params }: PageProps<"/g/[slug]">) {
  const { slug } = await params;

  // Phải chặn slug sai TRƯỚC Suspense. Dùng loading.tsx hay bọc phần này trong
  // Suspense thì header đã gửi đi trước khi notFound() chạy, và slug không tồn tại
  // sẽ trả về 200 kèm nội dung 404.
  if (!(await groupExists(slug))) notFound();

  return (
    <Suspense fallback={<GroupSkeleton />}>
      <GroupBody slug={slug} />
    </Suspense>
  );
}

async function GroupBody({ slug }: { slug: string }) {
  const group = await loadGroup(slug);
  if (!group) notFound();
  return <GroupClient group={group} />;
}
