"use client";

import { useEffect } from "react";

/**
 * Nói rõ chuyện gì xảy ra và làm gì tiếp theo.
 * Không "Rất tiếc, đã có lỗi xảy ra!".
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[chiadi]", error);
  }, [error]);

  return (
    <main className="empty pb-8">
      <div className="blob">🧾</div>
      <div className="text-[17px] font-medium mt14">Trang này không tải được</div>
      <p className="t14 m mt6 leading-[1.5]">
        Số liệu vẫn nguyên vẹn, chỉ là lần tải này hỏng. Thử lại một lần xem sao.
      </p>
      <div className="px-[18px] mt18">
        <button className="btn" onClick={reset}>
          Thử lại
        </button>
      </div>
    </main>
  );
}
