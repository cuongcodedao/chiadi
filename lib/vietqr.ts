/**
 * Helper dựng mã QR chuyển khoản VietQR.
 *
 * Không "server-only": màn 8 dựng URL ảnh ngay trong trình duyệt.
 * Không gọi API, không có khóa bí mật — chỉ ghép một URL ảnh tĩnh.
 */

/**
 * Bỏ dấu tiếng Việt và viết hoa — nội dung chuyển khoản ngân hàng chỉ nhận ASCII.
 * `Đà Lạt 3N2Đ` → `DA LAT 3N2D`
 */
export function toAsciiUpper(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // dấu thanh và dấu mũ
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export type BankInfo = {
  bankCode: string;
  bankAccount: string;
  bankHolder: string;
};

/**
 * Nội dung chuyển khoản: tên nhóm + tên người trả, không dấu, viết hoa.
 * Ngân hàng thường cắt quanh 50 ký tự nên cắt sẵn cho gọn.
 */
export function transferMemo(groupName: string, payerName: string): string {
  return toAsciiUpper(`${groupName} ${payerName}`).slice(0, 50).trim();
}

/**
 * Ảnh QR do VietQR dựng sẵn. Không gọi API, chỉ là URL ảnh — không có khóa bí mật,
 * không có dữ liệu nào rời khỏi trình duyệt người dùng ngoài những gì đã nằm trên QR.
 */
export function vietQrImageUrl(params: {
  bank: BankInfo;
  amount: number;
  memo: string;
}): string {
  const { bank, amount, memo } = params;
  const query = new URLSearchParams({
    amount: String(amount),
    addInfo: memo,
    accountName: toAsciiUpper(bank.bankHolder),
  });
  // qr_only: mã vuông, không kèm header VietQR — thông tin ngân hàng đã hiện
  // bằng chữ ngay dưới ô QR nên không cần in lại trong ảnh.
  const slug = `${encodeURIComponent(bank.bankCode)}-${encodeURIComponent(bank.bankAccount)}-qr_only.png`;
  return `https://img.vietqr.io/image/${slug}?${query.toString()}`;
}
