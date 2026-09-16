import { ImageResponse } from "next/og";

import { loadBeVietnamPro } from "@/lib/icon";

export const alt = "ChiaDi — chia tiền nhóm bằng một đường link";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * Ảnh hiện ra khi thả link vào nhóm chat. Đây là thứ quyết định người ta có bấm
 * vào hay không, nên nó dựng đúng dòng số dư của màn 3 chứ không phải logo suông.
 *
 * Cố ý KHÔNG lấy tên nhóm hay số tiền thật: ảnh này do máy chủ Zalo/Messenger tải
 * về và giữ lại, dữ liệu của nhóm không việc gì phải đi qua đó.
 */

export default async function OpengraphImage() {
  const [regular, medium] = await Promise.all([
    loadBeVietnamPro(400),
    loadBeVietnamPro(500),
  ]);

  const fonts = [
    regular && { name: "Be Vietnam Pro", data: regular, weight: 400 as const },
    medium && { name: "Be Vietnam Pro", data: medium, weight: 500 as const },
  ].filter((font) => font !== null);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#EDF0EA",
          color: "#12302A",
          padding: 72,
          fontFamily: fonts.length ? "Be Vietnam Pro" : undefined,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 14,
              background: "#12302A",
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 26,
            }}
          >
            ₫
          </div>
          <div style={{ fontSize: 32, fontWeight: 500 }}>ChiaDi</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 26, color: "#5F6B63" }}>Bạn đang</div>
          <div
            style={{
              fontSize: 104,
              fontWeight: 500,
              letterSpacing: -2,
              color: "#B5451F",
              marginTop: 8,
            }}
          >
            nợ 450.000đ
          </div>
          <div style={{ fontSize: 30, color: "#5F6B63", marginTop: 24 }}>
            Mở link để chọn tên mình và xem phần của bạn.
          </div>
        </div>

        <div style={{ display: "flex", gap: 12, fontSize: 24, color: "#5F6B63" }}>
          <div
            style={{
              border: "1px solid #D8DED4",
              borderRadius: 999,
              padding: "10px 22px",
            }}
          >
            Không cần cài app
          </div>
          <div
            style={{
              border: "1px solid #D8DED4",
              borderRadius: 999,
              padding: "10px 22px",
            }}
          >
            Không cần tài khoản
          </div>
        </div>
      </div>
    ),
    { ...size, fonts: fonts.length ? fonts : undefined },
  );
}
