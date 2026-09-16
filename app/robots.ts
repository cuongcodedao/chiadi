import type { MetadataRoute } from "next";

// Slug chính là mật khẩu. Trang nhóm không bao giờ được vào chỉ mục.
// Trang /g/[slug] còn đặt thêm robots: { index: false } trong metadata.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: "/g/",
    },
  };
}
