# Đưa ChiaDi lên mạng

Ba dịch vụ, đều có gói miễn phí đủ dùng: **Neon** (Postgres), **Upstash** (Redis cho
rate limit), **Vercel** (chạy Next.js). Tổng thời gian khoảng 20 phút.

Thứ tự bên dưới có lý do: phải có database và Redis trước, vì Vercel cần các biến
môi trường đó ngay ở lần build đầu.

## 1. Database — Neon

1. Tạo tài khoản ở <https://neon.tech>, tạo project tên `chiadi`, chọn region
   **Singapore (ap-southeast-1)** — gần người dùng Việt Nam nhất.
2. Chép **connection string** (dạng `postgresql://…?sslmode=require`).
3. Đẩy lược đồ lên:

   ```bash
   DATABASE_URL="postgresql://…?sslmode=require" npm run db:push:remote
   ```

   Chạy xong phải in ra `Xong. Đủ 7 bảng.` Lệnh này chạy lại được nhiều lần,
   không xóa dữ liệu cũ.

Dùng Supabase cũng được: lấy chuỗi ở mục **Connection pooling** (cổng `6543`),
đừng lấy chuỗi cổng `5432`. `db/client.ts` tự nhận ra chuỗi pooled và tắt
prepared statement.

## 2. Rate limit — Upstash

1. Tạo tài khoản ở <https://upstash.com>, tạo một Redis database, region
   **ap-southeast-1**.
2. Chép `UPSTASH_REDIS_REST_URL` và `UPSTASH_REDIS_REST_TOKEN` ở tab **REST API**.

Bỏ qua bước này thì app vẫn chạy, nhưng bộ đếm nằm trong RAM của từng instance
Vercel — tức là gần như không giới hạn gì. Chỉ nên bỏ qua khi còn đang thử.

## 3. Đưa mã lên GitHub

```bash
git add -A
git commit -m "ChiaDi"
gh repo create chiadi --private --source=. --push
```

## 4. Vercel

1. <https://vercel.com/new> → chọn repo `chiadi`. Framework tự nhận là Next.js,
   không cần sửa lệnh build.
2. Khai bốn biến môi trường (cả ba môi trường Production/Preview/Development):

   | Biến | Giá trị |
   |---|---|
   | `DATABASE_URL` | chuỗi kết nối Neon |
   | `UPSTASH_REDIS_REST_URL` | từ Upstash |
   | `UPSTASH_REDIS_REST_TOKEN` | từ Upstash |
   | `NEXT_PUBLIC_SITE_URL` | `https://<tên-miền-thật>` — bỏ trống cũng được, mã tự lấy tên miền Vercel |

3. Deploy. Xong thì mở đường dẫn Vercel cấp và tạo thử một nhóm.

## 5. Kiểm lại sau khi deploy

- [ ] Tạo nhóm, thêm khoản chi, số dư đúng
- [ ] `/robots.txt` có dòng `Disallow: /g/`
- [ ] Thả link nhóm vào Zalo hoặc Messenger — phải hiện ảnh preview ChiaDi.
      Không hiện thì `NEXT_PUBLIC_SITE_URL` đang sai, hoặc nền tảng còn cache
      bản cũ (Facebook: dùng Sharing Debugger để quét lại).
- [ ] Mở trên điện thoại, "Thêm vào màn hình chính" phải ra icon ₫ nền xanh đậm
- [ ] Điền tài khoản ngân hàng thật, quét thử mã QR bằng app ngân hàng — số tiền
      và nội dung phải điền sẵn đúng

## Sau này sửa lược đồ

`db/schema.sql` là nguồn chuẩn. Sửa xong thì chạy lại:

```bash
npm run db:push                                   # database local
DATABASE_URL="postgresql://…" npm run db:push:remote   # database thật
```

Mọi câu lệnh trong đó đều dạng `if not exists`, nên chạy lại an toàn. Đổi kiểu cột
hay xóa cột thì phải viết tay lệnh `alter` riêng — đừng sửa cột cũ tại chỗ trong
file này rồi tưởng nó tự đổi.
