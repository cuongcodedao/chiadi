import type { Metadata, Viewport } from "next";
import { Be_Vietnam_Pro } from "next/font/google";
import "./globals.css";

// Chỉ 400 và 500. DESIGN.md cấm 600/700 — không nạp thì dùng nhầm sẽ lộ ra ngay.
// Subset "vietnamese" bắt buộc, thiếu là dấu tiếng Việt rơi về font dự phòng.
const beVietnamPro = Be_Vietnam_Pro({
  variable: "--font-be-vietnam-pro",
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500"],
  display: "swap",
});

/**
 * Link ChiaDi sống trong nhóm chat, nên thẻ Open Graph là phần giao diện đầu
 * tiên người ta nhìn thấy. Zalo và Messenger cần URL tuyệt đối để lấy ảnh.
 */
const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3000");

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "ChiaDi",
  description: "Chia tiền nhóm bằng một đường link. Không cần cài app.",
  openGraph: {
    type: "website",
    siteName: "ChiaDi",
    locale: "vi_VN",
    title: "ChiaDi — chia tiền nhóm bằng một đường link",
    // Người nhận link cần biết phải làm gì tiếp theo, không cần nghe quảng cáo.
    description: "Mở link để chọn tên mình và xem bạn đang nợ ai, được nhận bao nhiêu.",
  },
  appleWebApp: { title: "ChiaDi", statusBarStyle: "default" },
  twitter: {
    card: "summary_large_image",
  },
};

/** Thanh trạng thái trên điện thoại ăn theo màu nền trang. */
export const viewport: Viewport = {
  themeColor: "#EDF0EA",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="vi"
      className={`${beVietnamPro.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans font-normal">
        {children}
      </body>
    </html>
  );
}
