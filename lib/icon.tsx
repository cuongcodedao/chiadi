import { ImageResponse } from "next/og";

/**
 * Satori chỉ đọc được TTF/OTF/WOFF. Gọi Google Fonts không kèm User-Agent hiện đại
 * thì nó trả về bản TrueType — đúng thứ cần. Bắt buộc phải có font này: font mặc
 * định của next/og không có ký tự ₫ lẫn dấu tiếng Việt, thiếu là ra ô vuông rỗng.
 */
export async function loadBeVietnamPro(
  weight: 400 | 500,
): Promise<ArrayBuffer | null> {
  try {
    const css = await fetch(
      `https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@${weight}&subset=vietnamese`,
      { headers: { "User-Agent": "Mozilla/4.0" } },
    ).then((response) => response.text());

    const url = css.match(/src: url\((.+?)\) format\('(truetype|opentype)'\)/)?.[1];
    if (!url) return null;

    return await fetch(url).then((response) => response.arrayBuffer());
  } catch {
    return null;
  }
}

/**
 * Icon ChiaDi: chữ ₫ trắng trên nền mực, bo góc như logo ở đầu trang.
 * Dùng chung cho favicon, icon iOS và icon trong manifest — một chỗ dựng,
 * không có ba file ảnh rời nhau rồi lệch nhau lúc nào không biết.
 */
export async function renderIcon(size: number) {
  const font = await loadBeVietnamPro(500);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#12302A",
          color: "#FFFFFF",
          // Favicon 32px mà bo góc theo tỷ lệ thì nhìn như hình tròn méo.
          borderRadius: size <= 48 ? size * 0.22 : size * 0.24,
          fontSize: size * 0.58,
          lineHeight: 1,
          fontFamily: font ? "Be Vietnam Pro" : undefined,
        }}
      >
        ₫
      </div>
    ),
    {
      width: size,
      height: size,
      fonts: font
        ? [{ name: "Be Vietnam Pro", data: font, weight: 500 as const }]
        : undefined,
    },
  );
}
