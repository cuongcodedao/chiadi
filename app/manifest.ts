import type { MetadataRoute } from "next";

/**
 * "Thêm vào màn hình chính" — icon ChiaDi, mở toàn màn hình, không thanh địa chỉ.
 * Gần app nhất mà vẫn là web: vẫn vào bằng link, không qua kho ứng dụng.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ChiaDi — chia tiền nhóm",
    short_name: "ChiaDi",
    description: "Chia tiền nhóm bằng một đường link. Không cần cài app.",
    lang: "vi",
    start_url: "/",
    display: "standalone",
    background_color: "#EDF0EA",
    theme_color: "#EDF0EA",
    icons: [
      { src: "/icons/192", sizes: "192x192", type: "image/png" },
      { src: "/icons/512", sizes: "512x512", type: "image/png" },
      // maskable: Android tự cắt theo hình nền máy, thiếu cái này là icon bị
      // bo thêm một lớp trắng bên ngoài.
      { src: "/icons/512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
