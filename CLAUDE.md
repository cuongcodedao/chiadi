@AGENTS.md

# ChiaDi

Web chia tiền nhóm cho người Việt. Một người tạo nhóm, nhận link, thả vào nhóm chat.
Cả nhóm mở link, chọn tên mình, tự thêm khoản đã trả. Trang hiện rõ ai nợ ai, kèm QR chuyển khoản.

**Không có đăng nhập, không có tài khoản, không có mật khẩu.** Ai có link là dùng được.
Đừng bao giờ đề xuất thêm màn hình đăng nhập/đăng ký.

## Mục tiêu sản phẩm

Sản phẩm này bán **sự minh bạch và việc gỡ bỏ nỗi ngại đòi tiền**, không bán máy tính bỏ túi.
Phép chia không phải phần khó — nỗi ngại nhắn "ê mày còn nợ tao" mới là vấn đề.
Mọi quyết định không phục vụ câu đó thì cắt.

Chỉ số thành công: **tỷ lệ nhóm có từ 3 thành viên trở lên cùng nhập liệu.**
Nếu chỉ một người nhập, sản phẩm đã thất bại dù mọi tính năng đều chạy.

Đối thủ chính là Fika (app Việt, offline, một người nhập rồi chụp màn hình gửi nhóm).
Khác biệt của ChiaDi: web qua link, cả nhóm cùng nhập, dữ liệu không mất, có QR ngân hàng.

## Công nghệ

Next.js App Router + TypeScript + Tailwind, Drizzle ORM, Postgres (Neon/Supabase),
deploy Vercel. Server Actions thay REST. Không dùng thư viện state phức tạp, `useState` là đủ.

## Cấu trúc

```
app/page.tsx                      landing: nav, hero + ô tạo nhóm, tính năng, cách dùng, FAQ
app/create-group-form.tsx         màn 1, ô chip nhập tên thành viên
app/recent-groups.tsx             nhóm đã mở trên máy này, đọc từ localStorage
app/actions.ts                    toàn bộ Server Actions (chỉ ghi)
app/error.tsx                     báo lỗi bằng giọng giao diện
app/robots.ts                     chặn /g/ khỏi công cụ tìm kiếm
app/opengraph-image.tsx           ảnh preview khi thả link vào nhóm chat
app/icon.tsx, apple-icon.tsx      favicon và icon iOS, dựng từ lib/icon.tsx
app/icons/[size]/route.tsx        icon 192 và 512 cho manifest
app/manifest.ts                   "thêm vào màn hình chính"
app/g/[slug]/page.tsx             server component, đã đặt noindex
app/g/[slug]/loading.tsx          khung xám mờ khớp bố cục màn 3
app/g/[slug]/not-found.tsx        404 khi slug không tồn tại
app/g/[slug]/group-client.tsx     UI chính: nhận diện, số dư, tab, chia sẻ link
app/g/[slug]/add-expense-sheet.tsx sheet thêm VÀ sửa khoản chi
app/g/[slug]/qr-sheet.tsx         màn 8, mã QR chuyển khoản
app/g/[slug]/bank-sheet.tsx       màn 9, tài khoản nhận tiền
app/g/[slug]/history/            màn 10, lịch sử thay đổi
app/g/[slug]/use-escape.ts        hook đóng sheet bằng phím Esc
lib/split.ts                      TOÀN BỘ logic tính tiền
lib/split.test.ts                 13 test, có test ngẫu nhiên
lib/rate-limit.ts                 rate limit theo IP (server-only)
lib/vietqr.ts                     dựng URL ảnh QR, bỏ dấu tiếng Việt
lib/identity.ts                   localStorage: mình là ai, tài khoản ngân hàng, nhóm đã mở
lib/ui.ts                         chữ nghĩa dùng chung: ngày giờ, dòng phụ khoản chi
lib/banks.ts                      42 ngân hàng nhận VietQR, `code` là mã BIN
lib/icon.tsx                      nạp font cho next/og + dựng icon ₫
db/schema.sql                     DDL gốc, có hàm assert_expense_balanced
db/schema.ts                      Drizzle schema
db/queries.ts                     phía đọc: nạp nhóm, tính số dư, lịch sử
DEPLOY.md                         các bước đưa lên Neon + Upstash + Vercel
scripts/push-schema.mjs           đẩy db/schema.sql lên database (npm run db:push)
db/client.ts                      kết nối
design/DESIGN.md                  token và quy tắc thiết kế
design/mockups.html               bản dựng 10 màn hình, mở bằng trình duyệt
```

## Bất biến tuyệt đối — vi phạm là hỏng dữ liệu tiền

1. **Tiền luôn là số nguyên, đơn vị đồng.** Không bao giờ dùng float, không bao giờ dùng
   số lẻ thập phân. Cột Postgres là `bigint`.
2. **Với mỗi khoản chi: tổng payers = tổng shares = total.** Kiểm ở `validateExpense`
   (ứng dụng) và `assert_expense_balanced` (database, trong cùng transaction). Giữ cả hai.
3. **Luôn lưu số tiền đã tính sẵn trong `expense_shares`**, không lưu tỷ lệ rồi tính lúc render.
   100.000đ chia 3 không chia hết — phải quyết ai chịu phần lẻ ngay lúc ghi.
4. **Tổng số dư toàn nhóm luôn bằng 0.** `computeBalances` tự kiểm và ném lỗi nếu lệch.
5. **Chạy `npm test` sau mọi thay đổi trong `lib/split.ts`.** Đây là phần dễ sai âm thầm nhất.

## Bảo mật

- **Slug chính là mật khẩu.** Không endpoint liệt kê nhóm, không đưa slug vào sitemap,
  luôn giữ `robots: { index: false }` trên trang nhóm. Cần thêm `robots.txt` chặn `/g/`.
- **`actorId` do client gửi, server KHÔNG xác minh được.** Đây là cái giá của việc bỏ đăng nhập,
  chấp nhận được với nhóm bạn bè. Bù lại bằng cách **ghi lịch sử mọi thao tác** vào bảng
  `activities`. Đừng đề xuất "sửa" bằng cách thêm auth.
- Mọi input validate bằng Zod ở server. Rate limit theo IP.

## Quy ước giao diện

**Trước khi sửa bất kỳ UI nào, đọc `design/DESIGN.md` và mở `design/mockups.html`.**
Hai file đó là nguồn chuẩn cho màu, cỡ chữ, khoảng cách và các quyết định đã chốt.
Khi mâu thuẫn, `mockups.html` thắng.

Tóm tắt: mực `#12302A`, nền `#EDF0EA`, bề mặt `#FFFFFF`, nhấn `#0E7C66`,
cảnh báo `#B5451F`, chữ phụ `#5F6B63`, đường kẻ `#D8DED4`.
Màu nhấn và cảnh báo chỉ mang **ý nghĩa** (dương/âm), không dùng trang trí.

Font `Be Vietnam Pro`, chỉ weight 400 và 500. Số tiền bật `tabular-nums`.
Định dạng `450.000đ`, số âm dùng dấu trừ thật `−`.

Mobile-first, khung 380–430px. Khổ 520px nằm trên `main`.
Trên máy tính thì nới ra, **khác với `DESIGN.md` bản đầu** (bản đó chốt 520px ở mọi
kích thước): landing dùng `main.wide` chạy hết bề ngang; màn hình nhóm (`main.screen`)
từ 720px rộng 660px, từ 1000px thành lưới hai cột — số dư và nút bên trái, danh sách
bên phải; trang lịch sử (`main.reading`) nới lên 660px.

Bố cục của `main.screen` nằm hết trong CSS, không dùng utility Tailwind: `flex` của
Tailwind thuộc tầng utilities nên nó đè `display: grid` khai ở tầng components. Nút tối thiểu 44px.
Nhập một khoản chi phải xong dưới 15 giây.

**Dồn toàn bộ sự táo bạo vào một chỗ:** dòng cho biết người đang xem nợ ai bao nhiêu.
Mọi thứ khác lùi lại.

Chữ trong giao diện: tiếng Việt có dấu, thân mật, tự nhiên.
Thông báo lỗi nói rõ chuyện gì xảy ra (`Số tiền phải lớn hơn 0`),
không xin lỗi vòng vo (`Rất tiếc, đã có lỗi xảy ra!`).

## Đã xong

Toàn bộ 10 màn trong `design/mockups.html`, cộng trang 404 và trang lịch sử.
Logic tính tiền + 13 test, schema và trigger `assert_expense_balanced`, Server Actions,
QR VietQR, nhận diện thành viên qua localStorage, sửa và xóa khoản chi,
sheet nhập thông tin ngân hàng, `robots.txt` chặn `/g/`, khung xám mờ lúc tải.

## Còn lại

1. Chưa deploy. Các bước nằm ở `DEPLOY.md` — cần tài khoản Neon, Upstash, Vercel
2. Chưa dán được danh sách tên vào ô thành viên; chưa xóa được nhóm

## Khác với tài liệu gốc

- Helper VietQR nằm ở `lib/vietqr.ts`, không nằm trong `lib/rate-limit.ts`:
  `rate-limit.ts` là `server-only` mà màn 8 dựng URL ảnh QR ngay trong trình duyệt
- Phía đọc nằm ở `db/queries.ts` — mọi export trong file `"use server"` đều thành
  endpoint nên hàm đọc không để lẫn vào `app/actions.ts`
- Slug dài 12 ký tự, không phải 7 như bản dựng: slug chính là mật khẩu, 7 ký tự chỉ
  khoảng 35 bit
- Mọi ảnh sinh bằng `next/og` phải tự nạp Be Vietnam Pro qua `lib/icon.tsx`:
  font mặc định của next/og không có ký tự ₫ lẫn dấu tiếng Việt, thiếu là ra ô vuông
- Ảnh Open Graph cố tình KHÔNG lấy tên nhóm hay số tiền thật: máy chủ Zalo/Messenger
  tải ảnh đó về và giữ lại, dữ liệu nhóm không việc gì đi qua đó
- "Nhiều người cùng trả" là **ô đánh dấu**, bản dựng vẽ nó thành liên kết chữ:
  đó là một chế độ đang bật hay tắt, liên kết không nói được trạng thái. Bật lên
  thì gán sẵn cả khoản cho người đang trả, để không hiện ngay hộp báo lệch đỏ
- Bộ đếm suất có vạch ngăn giữa −, số, + (`.stepper`); trước đó ba ô dính liền và
  số tiền "—" đứng cạnh trông như một cái nút thứ hai
- Thông tin ngân hàng để thẳng trên bảng `members`, không tách bảng riêng
- `expense_shares.units` giữ số suất đã gõ. Tiền vẫn nằm ở `amount` như cũ —
  cột này chỉ để mở khoản chi ra sửa thì thấy lại đúng số suất
- Xóa thành viên chỉ cho phép khi người đó chưa dính vào đồng nào. Xóa người đã có
  khoản chi là xóa luôn phần chia của họ và tổng sẽ lệch, đúng thứ
  `assert_expense_balanced` sinh ra để chặn
- Trả một phần: màn 8 cho sửa số tiền trước khi dựng QR, `markSettled` vốn đã nhận
  số tiền bất kỳ nên không phải đổi gì ở server
- Mã ngân hàng lưu bằng **BIN sáu số** của VietQR (`970436`), không phải tên viết
  thường: BIN không đổi khi ngân hàng đổi tên, và `img.vietqr.io` nhận thẳng
- Bảng chọn sau nút `⋯` gom bốn việc hiếm làm: đổi người đang dùng
  ("Tôi không phải X"), sửa nhóm, lịch sử, tạo nhóm mới. Chọn nhầm tên mình là
  xem số dư người khác và ghi khoản chi sai người, nên phải đổi lại được
- `chiadi:groups` trong localStorage giữ tối đa 8 nhóm đã mở, trang chủ hiện lại
  thành khối "Nhóm bạn đã mở". Không có tài khoản nên mất link là mất đường vào —
  đây là cái phao duy nhất, và nó chỉ sống trong đúng trình duyệt đó
- Tài khoản nhận tiền còn được nhớ trong localStorage (`chiadi:bank`) và điền sẵn
  cho **chính chủ** ở nhóm mới — vào nhóm khác chỉ cần bấm Lưu. Không bao giờ điền
  sẵn khi đang khai hộ người khác
- `activities` có thêm cột `actor_name`, và `summary` chỉ chứa vị ngữ để giao diện
  tự thay "Bạn" khi trùng người đang xem

## Đừng làm

OCR hóa đơn (hóa đơn quán Việt viết tay, sửa lại còn lâu hơn gõ tay).
Đăng nhập. App di động riêng. Thông báo đẩy. Nhiều loại tiền tệ. Biểu đồ thống kê.
Tích hợp ví điện tử để tự chuyển tiền (cần giấy phép trung gian thanh toán).
Chia theo phần trăm (trùng công dụng với chia theo suất).

## Lệnh

```bash
npm run dev
npm test                  # node --experimental-strip-types --test lib/split.test.ts
npm run build             # chạy trước khi deploy, bắt lỗi chỉ hiện lúc build
npm run db:push           # đẩy db/schema.sql lên database trong .env.local
DATABASE_URL="…" npm run db:push:remote   # lên database thật
```
