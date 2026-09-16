import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { groupExists, loadActivities } from "@/db/queries";

import { HistorySkeleton } from "../skeletons";
import { HistoryList } from "./history-list";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function HistoryPage({ params }: PageProps<"/g/[slug]/history">) {
  const { slug } = await params;

  // Xem chú thích ở app/g/[slug]/page.tsx — kiểm trước, stream sau.
  if (!(await groupExists(slug))) notFound();

  return (
    <Suspense fallback={<HistorySkeleton />}>
      <HistoryBody slug={slug} />
    </Suspense>
  );
}

async function HistoryBody({ slug }: { slug: string }) {
  const entries = await loadActivities(slug);
  if (!entries) notFound();
  return <HistoryList slug={slug} entries={entries} />;
}
