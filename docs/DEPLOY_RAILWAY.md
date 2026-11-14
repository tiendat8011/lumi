# Deploy Lumi Lite lên Railway

## Tổng quan

Railway cho phép deploy miễn phí (trial $5/tháng) hoặc trả phí ($5/tháng Hobby).
Bạn sẽ deploy 4 service: **PostgreSQL**, **MinIO** (storage), **API**, **Web**.
Railway cung cấp HTTPS miễn phí qua subdomain `*.up.railway.app`.

---

## Bước 1: Tạo tài khoản Railway

1. Truy cập [railway.app](https://railway.app) → **Login with GitHub**
2. Kết nối repo GitHub chứa code Lumi Lite

---

## Bước 2: Tạo Project mới

1. Dashboard → **New Project**
2. Chọn **Empty Project**

---

## Bước 3: Thêm PostgreSQL

1. Trong project → **+ New** → **Database** → **PostgreSQL**
2. Railway tự tạo database và cung cấp `DATABASE_URL`
3. Vào tab **Variables** của PostgreSQL, copy `DATABASE_URL` (dạng `postgresql://...`)

---

## Bước 4: Deploy API

1. **+ New** → **GitHub Repo** → chọn repo
2. Trong Settings:
   - **Root Directory**: `apps/api`
   - **Builder**: Dockerfile
3. Vào tab **Variables**, thêm:

```env
NODE_ENV=production
PORT=4000
DATABASE_URL=<paste từ PostgreSQL service>
CORS_ORIGIN=https://<web-service>.up.railway.app
JWT_SECRET=<chạy: openssl rand -hex 32>
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
APP_BASE_URL=https://<web-service>.up.railway.app
```

4. Vào tab **Settings** → **Networking** → **Generate Domain**
   - Bạn sẽ có URL dạng: `https://lumi-api-xxx.up.railway.app`
5. Storage tạm thời bỏ qua MinIO (uploads sẽ dùng sau)

---

## Bước 5: Deploy Web

1. **+ New** → **GitHub Repo** → chọn cùng repo
2. Trong Settings:
   - **Root Directory**: `apps/web`
   - **Builder**: Dockerfile
3. Vào tab **Variables**, thêm:

```env
NEXT_PUBLIC_API_URL=https://<api-service>.up.railway.app/api
```

4. Vào **Settings** → **Networking** → **Generate Domain**
   - URL dạng: `https://lumi-web-xxx.up.railway.app`

---

## Bước 6: Cập nhật CORS

Quay lại API service → Variables:
- Sửa `CORS_ORIGIN` = URL thực của web service (VD: `https://lumi-web-xxx.up.railway.app`)
- Sửa `APP_BASE_URL` = URL thực của web service

---

## Bước 7: Chạy migration

Railway tự chạy `prisma migrate deploy` khi container start (đã cấu hình trong Dockerfile CMD).

Kiểm tra: vào API service → **Logs** → tìm dòng `Applied all pending migrations`.

---

## Bước 8: Seed dữ liệu (lần đầu)

Vào API service → tab **Shell**:

```bash
npx prisma db seed
```

Hoặc tạo tài khoản qua API:
```bash
curl -X POST https://<api-url>/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"teacher@example.com","password":"YourStrongP@ss123","displayName":"Giáo viên","role":"TEACHER"}'
```

---

## Bước 9: Truy cập

- **Web**: `https://lumi-web-xxx.up.railway.app`
- **API**: `https://lumi-api-xxx.up.railway.app/api`

---

## Bảo mật đã cấu hình

| Tính năng | Chi tiết |
|---|---|
| **HTTPS/SSL** | Railway cung cấp tự động cho `*.up.railway.app` |
| **Helmet headers** | X-Frame-Options, X-Content-Type-Options, XSS-Protection, HSTS |
| **Rate limiting** | 100 req/phút/IP tại API, 30 req/giây tại nginx |
| **CORS locked** | Chỉ cho phép origin từ web domain |
| **JWT rotation** | Access token 15 phút, refresh token 7 ngày |
| **Input validation** | class-validator whitelist + forbidNonWhitelisted |
| **Password hashing** | bcrypt với salt rounds |
| **DB không public** | PostgreSQL chỉ truy cập nội bộ Railway |

---

## Thêm Domain riêng (tùy chọn)

1. Mua domain (VD: Namecheap, GoDaddy, Cloudflare)
2. Trong Railway → Web service → Settings → Networking → **Custom Domain**
3. Thêm domain, Railway sẽ cho bạn CNAME record
4. Vào DNS provider → thêm CNAME record trỏ về Railway
5. Railway tự cấp SSL certificate (Let's Encrypt)
6. Cập nhật `CORS_ORIGIN` và `APP_BASE_URL` ở API service

---

## Thêm Storage (MinIO cho upload file)

### Option A: Railway Volume (đơn giản, giới hạn 5GB free)

Không cần MinIO. Để `MINIO_ENDPOINT` trống → StorageService sẽ tắt và trả 503 cho upload.
Nếu cần upload, deploy MinIO:

### Option B: MinIO trên Railway

1. **+ New** → **Docker Image** → `minio/minio`
2. Start Command: `server /data --console-address :9001`
3. Variables:
   ```
   MINIO_ROOT_USER=<openssl rand -hex 16>
   MINIO_ROOT_PASSWORD=<openssl rand -hex 16>
   ```
4. Settings → Networking → Port: 9000
5. Cập nhật API variables:
   ```
   MINIO_ENDPOINT=<minio-service-name>.railway.internal
   MINIO_PORT=9000
   MINIO_ACCESS_KEY=<same as MINIO_ROOT_USER>
   MINIO_SECRET_KEY=<same as MINIO_ROOT_PASSWORD>
   MINIO_BUCKET=lumi
   ```

### Option C: Cloudflare R2 / AWS S3 (khuyến nghị cho production)

Dùng S3-compatible storage. Cấu hình MinIO client trỏ tới S3 endpoint.

---

## Chi phí ước tính (Railway Hobby $5/tháng)

| Service | RAM | Chi phí/tháng |
|---|---|---|
| PostgreSQL | 512MB | ~$1-2 |
| API | 512MB | ~$1-2 |
| Web | 256MB | ~$0.5-1 |
| MinIO (nếu dùng) | 256MB | ~$0.5-1 |
| **Tổng** | | **~$3-5/tháng** |

Trial plan: $5 miễn phí, đủ chạy ~1 tháng.

---

## Troubleshooting

| Vấn đề | Giải pháp |
|---|---|
| API không khởi động | Kiểm tra Logs → DATABASE_URL đúng chưa |
| Web trắng | Kiểm tra NEXT_PUBLIC_API_URL trỏ đúng API URL |
| CORS error | Kiểm tra CORS_ORIGIN = URL web (không có / cuối) |
| Upload lỗi 503 | MINIO_ENDPOINT chưa set hoặc MinIO chưa deploy |
| Migration fail | Vào Shell chạy `npx prisma migrate deploy` thủ công |
