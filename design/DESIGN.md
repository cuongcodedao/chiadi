# Thiết kế ChiaDi

Bản dựng đầy đủ 10 màn hình: `design/mockups.html` — mở bằng trình duyệt.
File này là nguồn chuẩn cho token và quy tắc. Khi có mâu thuẫn, `mockups.html` thắng.

## Nguyên tắc chi phối

Sản phẩm về **tiền giữa bạn bè** — vừa phải chính xác đến từng đồng, vừa không được
lạnh lùng như app ngân hàng. Cảm giác của một tờ biên lai viết tay được giữ cẩn thận.

**Dồn toàn bộ sự táo bạo vào một chỗ duy nhất:** dòng cho biết người đang xem nợ ai bao nhiêu.
Đó là thứ họ mở link lên để xem. Mọi thứ còn lại lùi lại, im lặng, có kỷ luật.

Thước đo: **người thứ tư trong nhóm** — không tạo nhóm, không rành công nghệ, đang ở chỗ ồn —
phải hiểu trong 5 giây mình nợ ai bao nhiêu và làm gì tiếp theo.

## Token

| Vai trò | Mã | Dùng cho |
|---|---|---|
| Mực | `#12302A` | Chữ chính, số tiền, nút chính |
| Nền | `#EDF0EA` | Nền trang |
| Bề mặt | `#FFFFFF` | Thẻ, sheet, ô nhập |
| Nhấn | `#0E7C66` | Nút QR, liên kết, số dư dương |
| Cảnh báo | `#B5451F` | Số dư âm, lỗi |
| Chữ phụ | `#5F6B63` | Nhãn, mô tả, ngày |
| Đường kẻ | `#D8DED4` | Viền |
| Đường mờ | `#E4E8E1` | Phân cách trong thẻ |
| Chip | `#E1EAE4` | Avatar, chip đã chọn |
| Ô nhập | `#F4F6F2` | Nền field trong sheet |
| Nền tab | `#E2E7DE` | Thanh chuyển tab |
| Nền cảnh báo | `#FBEDE7` | Hộp báo lệch tổng |

Màu nhấn và cảnh báo **chỉ mang ý nghĩa** (dương/âm, nhận/trả), không dùng trang trí.

## Chữ

Một họ duy nhất: **Be Vietnam Pro** — thiết kế riêng cho dấu tiếng Việt, đó là lý do chọn.
Chỉ hai weight: 400 và 500. Không dùng 600/700.

| Dùng cho | Cỡ | Weight |
|---|---|---|
| Số dư chính | 36px | 500, letter-spacing −0.5px |
| Số tiền trong sheet | 34px | 500 |
| Tiêu đề sheet | 17–18px | 500 |
| Tên nhóm | 16px | 500 |
| Nội dung, tên người | 15px | 400 |
| Số tiền trong danh sách | 15px | 500 |
| Nhãn, chú thích | 13px | 400 |
| Ngày giờ, ghi chú | 12px | 400 |

Số tiền **bắt buộc** `font-variant-numeric: tabular-nums`.
Định dạng `450.000đ` — dấu chấm ngăn nghìn, `đ` liền sau, không khoảng trắng, không thập phân.
Số âm dùng dấu trừ thật `−` (U+2212), không dùng gạch nối.

## Bố cục

Mobile-first, khung thật 380–430px. Desktop chỉ giới hạn `max-width: 520px` căn giữa —
đây không phải sản phẩm dùng trên máy tính.

Padding ngang trang: 16px. Trong sheet: 18px. Nút tối thiểu 44px cao.
Bo góc: thẻ và nút 12px, ô nhập 10px, chip 8px, sheet 18px (chỉ hai góc trên), avatar tròn.
Vùng thao tác chính ở nửa dưới màn hình, trong tầm ngón cái.

## Quy tắc nội dung

Tiếng Việt có dấu, thân mật, tự nhiên. Không trịnh trọng.

Lỗi nói rõ chuyện gì xảy ra và cách sửa, bằng giọng giao diện:
`Số tiền phải lớn hơn 0`, `Còn thiếu 80.000đ chưa chia`.
Không viết `Rất tiếc, đã có lỗi xảy ra!`.

Đang tải: khung xám mờ đúng hình dạng nội dung, không dùng vòng xoay.

## Những thứ tránh

Không nền kem `#F4F1EA` + serif + màu đất nung (kiểu mặc định AI hay sinh ra).
Không nền đen với một màu neon. Không chặt nội dung thành thẻ bo góc giống hệt nhau
đổ cùng một bóng mờ. Không nhãn viết hoa toàn bộ. Không `A · B · C` làm trang trí
(dấu chấm giữa chỉ dùng phân tách hai thông tin cùng cấp, như `Minh trả · chia cho 5 người`).
Không mũi tên cuối nút. Không đánh số `01 / 02 / 03`. Không gradient trang trí.

Chuyển động chỉ để phản hồi thao tác — sheet trượt lên, số dư đổi mượt sau khi thêm khoản chi.
Không hiệu ứng trôi lên khi cuộn, không hover trên mọi thẻ. Tôn trọng `prefers-reduced-motion`.

## Quyết định đã chốt trong bản dựng

- **Số dư nợ nổi thẳng trên nền, không bọc trong thẻ.** Mọi thứ khác đều là thẻ, nên nó
  đứng riêng và mắt tìm đến trước. Màu cảnh báo chỉ xuất hiện đúng một lần mỗi màn hình.
- **Nút QR đặt cạnh từng dòng người nhận**, không gom vào một chỗ. Người dùng nghĩ theo
  đơn vị "trả Minh", không phải "thanh toán".
- **"Đã chuyển" cố ý nhỏ và mờ.** Bấm nhầm là ghi sai số dư, nên nó không được hấp dẫn
  bằng nút QR. Phải có trạng thái đang lưu để chặn bấm hai lần.
- **Dòng phụ mỗi khoản chi ghi rõ ai trả và chia cho mấy người** — chống nghi ngờ,
  liếc qua là kiểm chứng được mà không cần bấm vào.
- **Số dư cả nhóm xếp từ người nợ nhiều nhất xuống người được nhận nhiều nhất**,
  không xếp theo bảng chữ cái.
- **Dòng liên quan đến người đang xem được tô nền `#F2F6F3`** trong danh sách trả gọn nhất.
- **Lịch sử ghi cả giá trị cũ và mới khi có người sửa** — đây là thứ dập tắt tranh cãi.
- **Màn hình trống ưu tiên nút gửi link hơn nút thêm khoản chi.** Lúc nhóm vừa tạo,
  việc cần nhất là kéo người khác vào.
