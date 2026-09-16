/**
 * Ngân hàng cho ô chọn ở màn 9.
 *
 * `code` là mã BIN sáu số của VietQR — dùng thẳng trong URL ảnh QR và không đổi
 * khi ngân hàng đổi tên (Bản Việt → BVBank, OceanBank → MBV đều đã xảy ra).
 * Danh sách lấy từ https://api.vietqr.io/v2/banks, chỉ giữ nơi
 * `transferSupported` — chỗ không nhận chuyển khoản qua VietQR thì dựng QR ra
 * cũng không quét được, để trong danh sách chỉ tổ gây hiểu nhầm.
 *
 * Xếp phổ biến trước, còn lại theo bảng chữ cái.
 */
export type Bank = {
  code: string;
  name: string;
  /**
   * Mã app trong deeplink của VietQR: https://dl.vietqr.io/pay?app=<app>
   * Thiếu thì màn 8 không hiện nút mở app — thà không có nút còn hơn nút bấm
   * vào không mở được gì.
   */
  app?: string;
};

export const BANKS: Bank[] = [
  { code: "970436", name: "Vietcombank", app: "vcb" },
  { code: "970407", name: "Techcombank", app: "tcb" },
  { code: "970422", name: "MB Bank", app: "mb" },
  { code: "970415", name: "VietinBank", app: "icb" },
  { code: "970418", name: "BIDV", app: "bidv" },
  { code: "970416", name: "ACB", app: "acb" },
  { code: "970432", name: "VPBank", app: "vpb" },
  { code: "970423", name: "TPBank", app: "tpb" },
  { code: "970403", name: "Sacombank" },
  { code: "970405", name: "Agribank", app: "vba" },
  { code: "970437", name: "HDBank", app: "hdb" },
  { code: "970441", name: "VIB", app: "vib" },
  { code: "970443", name: "SHB", app: "shb" },
  { code: "970426", name: "MSB" },
  { code: "970448", name: "OCB", app: "ocb" },
  { code: "970440", name: "SeABank", app: "seab" },
  { code: "970431", name: "Eximbank", app: "eib" },
  { code: "970449", name: "LPBank", app: "lpb" },
  { code: "970428", name: "Nam A Bank", app: "nab" },
  { code: "970409", name: "Bac A Bank" },
  { code: "970425", name: "ABBANK", app: "abb" },
  { code: "970412", name: "PVcomBank", app: "pvcb" },
  { code: "970400", name: "SaigonBank", app: "sgicb" },
  { code: "970429", name: "SCB", app: "scb" },
  { code: "970438", name: "BaoViet Bank", app: "bvb" },
  { code: "970454", name: "BVBank (Bản Việt)" },
  { code: "546034", name: "Cake by VPBank", app: "cake" },
  { code: "422589", name: "CIMB", app: "cimb" },
  { code: "970446", name: "Co-op Bank", app: "coopbank" },
  { code: "668888", name: "KBank" },
  { code: "970452", name: "KienLong Bank", app: "klb" },
  { code: "970414", name: "MBV (OceanBank)" },
  { code: "970419", name: "NCB", app: "ncb" },
  { code: "970430", name: "PGBank" },
  { code: "971133", name: "PVcomBank Pay" },
  { code: "970424", name: "Shinhan Bank", app: "shbvn" },
  { code: "963388", name: "Timo", app: "timo" },
  { code: "546035", name: "Ubank by VPBank" },
  { code: "971025", name: "Ví MoMo" },
  { code: "970427", name: "Viet A Bank", app: "vab" },
  { code: "970433", name: "Viet Bank", app: "vietbank" },
  { code: "970457", name: "Woori Bank", app: "wvn" },
];

/** Link mở thẳng app ngân hàng của người nhận, nếu VietQR có hỗ trợ. */
export function bankAppLink(code: string | null | undefined): string | null {
  const app = code ? BANKS.find((b) => b.code === code)?.app : null;
  return app ? `https://dl.vietqr.io/pay?app=${app}` : null;
}

export function bankName(code: string | null | undefined): string {
  if (!code) return "";
  return BANKS.find((b) => b.code === code)?.name ?? code;
}
