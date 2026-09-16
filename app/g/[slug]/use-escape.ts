"use client";

import { useEffect } from "react";

/**
 * Sheet là hộp thoại (`aria-modal`), nên phím Esc phải đóng được nó —
 * trên máy tính đó là phản xạ, và bấm ra ngoài chỉ đóng được khi có scrim.
 */
export function useEscape(onEscape: () => void): void {
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onEscape();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onEscape]);
}
