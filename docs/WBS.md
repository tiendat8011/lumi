# Lumi Lite — Work Breakdown Structure (WBS)

> **Quy mô**: 100 concurrent users
> **Auto-submit on expiry**: Có — tự chấm bài đã lưu khi hết giờ
> **Tổng ước lượng**: 53–70 ngày công (1 mid-level developer)

---

## WBS Overview

```
1.  Project Setup & Infrastructure
2.  Authentication & User Management
3.  Classroom Management
4.  Question Bank
4A. File Upload & Image Support
4B. Google Docs Import
5.  Exam Management
6.  Assignment Flow
7.  Exam Attempt Engine
8.  Grading & Results
9.  Frontend Application
10. Deployment & Operations
```

---

## 1. Project Setup & Infrastructure — 3–4 ngày

| ID | Task | Output | Effort | Phụ thuộc |
|---|---|---|---|---|
| 1.1 | Khởi tạo monorepo (`apps/api`, `apps/web`) | Cấu trúc thư mục, root `package.json` | 0.25d | — |
| 1.2 | Scaffold NestJS + Fastify adapter | App chạy được, `GET /health` trả 200 | 0.5d | 1.1 |
| 1.3 | Scaffold Next.js + TypeScript + Tailwind CSS | `npm run dev` hiển thị trang mặc định | 0.5d | 1.1 |
| 1.4 | Cấu hình Prisma + PostgreSQL | `schema.prisma`, kết nối DB thành công | 0.25d | 1.2 |
| 1.5 | Docker Compose (PostgreSQL, API, Web, Nginx) | `docker-compose up` khởi động toàn bộ stack | 0.5d | 1.2, 1.3 |
| 1.6 | Cấu hình ESLint, Prettier, TypeScript strict | `npm run lint` pass | 0.25d | 1.2, 1.3 |
| 1.7 | Setup Jest + Supertest cho backend | `npm run test` chạy được | 0.25d | 1.2 |
| 1.8 | Global ValidationPipe + class-validator | Input không hợp lệ trả lỗi chuẩn | 0.25d | 1.2 |
| 1.9 | HttpExceptionFilter (error envelope) | Mọi lỗi trả format `{ success: false, error: { code, message } }` | 0.25d | 1.2 |
| 1.10 | TransformInterceptor (response envelope) | Mọi response trả format `{ success: true, data, meta }` | 0.25d | 1.2 |
| 1.11 | Configuration module (env validation) | `.env.example`, biến môi trường được validate khi start | 0.25d | 1.2 |
| 1.12 | Pagination DTO + helper | `PaginationQueryDto`, `paginate()` util | 0.25d | 1.8 |

**Deliverable**: Dự án chạy được với Docker Compose, có health check, validation, error handling chuẩn hóa.

---

## 2. Authentication & User Management — 5–6 ngày

| ID | Task | Output | Effort | Phụ thuộc |
|---|---|---|---|---|
| 2.1 | Prisma migration: bảng `users` | Bảng users với email unique, role enum | 0.25d | 1.4 |
| 2.2 | Prisma migration: bảng `refresh_tokens` | Bảng lưu refresh token hashed | 0.25d | 2.1 |
| 2.3 | UsersModule + UsersService | `findByEmail()`, `findById()`, `create()` | 0.5d | 2.1 |
| 2.4 | `POST /auth/register` | Đăng ký với email, password (bcrypt), role | 0.5d | 2.3 |
| 2.5 | `POST /auth/login` | Trả access token (15min) + refresh token (7d) | 0.75d | 2.3 |
| 2.6 | JWT Strategy (Passport) | Validate access token, attach user vào request | 0.5d | 2.5 |
| 2.7 | `JwtAuthGuard` global | Route bảo vệ từ chối request không có token | 0.25d | 2.6 |
| 2.8 | `@Roles()` decorator + `RolesGuard` | Kiểm tra role, trả 403 nếu không đúng | 0.25d | 2.7 |
| 2.9 | `@CurrentUser()` decorator | Lấy user từ request | 0.25d | 2.6 |
| 2.10 | `POST /auth/refresh` | Refresh token rotation, trả access token mới | 0.5d | 2.5 |
| 2.11 | `POST /auth/logout` | Xóa refresh token, không dùng lại được | 0.25d | 2.5 |
| 2.12 | `GET /users/me` | Trả profile user hiện tại | 0.25d | 2.9 |
| 2.13 | Unit tests: AuthService | Hash, token generation, validation | 0.5d | 2.4–2.11 |
| 2.14 | E2e tests: auth flow | Register → login → me → refresh → logout → refresh fail | 0.75d | 2.4–2.12 |

**Deliverable**: Hệ thống auth hoàn chỉnh với JWT, refresh token rotation, role guard.

---

## 3. Classroom Management — 3–4 ngày

| ID | Task | Output | Effort | Phụ thuộc |
|---|---|---|---|---|
| 3.1 | Prisma migration: `classrooms` + `classroom_members` | Bảng với join_code unique, member unique constraint | 0.25d | 2.1 |
| 3.2 | `POST /classrooms` (TEACHER) | Tạo lớp, sinh join_code 6 ký tự | 0.5d | 3.1 |
| 3.3 | `GET /classrooms` | Teacher: lớp mình tạo. Student: lớp mình tham gia | 0.5d | 3.1 |
| 3.4 | `GET /classrooms/:id` | Chi tiết lớp, kiểm tra quyền truy cập | 0.25d | 3.3 |
| 3.5 | `POST /classrooms/:id/join` (STUDENT) | Tham gia bằng mã, idempotent khi join lại | 0.5d | 3.1 |
| 3.6 | `GET /classrooms/:id/members` (TEACHER owner) | Danh sách thành viên | 0.25d | 3.1 |
| 3.7 | Unit tests: join code generation, duplicate join | | 0.25d | 3.2, 3.5 |
| 3.8 | E2e tests: classroom flow | Tạo → join → list members → authorization | 0.5d | 3.2–3.6 |

**Deliverable**: Giáo viên tạo lớp, học sinh tham gia bằng mã, xem danh sách thành viên.

---

## 4. Question Bank — 3–4 ngày

| ID | Task | Output | Effort | Phụ thuộc |
|---|---|---|---|---|
| 4.1 | Prisma migration: `questions` + `question_options` | Bảng với position, is_correct | 0.25d | 2.1 |
| 4.2 | `POST /questions` (TEACHER) | Tạo câu hỏi MCQ + options trong transaction | 0.75d | 4.1 |
| 4.3 | `GET /questions` (TEACHER, phân trang) | Danh sách câu hỏi của mình + options | 0.5d | 4.1 |
| 4.4 | `GET /questions/:id` (TEACHER owner) | Chi tiết câu hỏi | 0.25d | 4.1 |
| 4.5 | `PATCH /questions/:id` (TEACHER owner) | Cập nhật nội dung + thay đổi options | 0.5d | 4.1 |
| 4.6 | `DELETE /questions/:id` (TEACHER owner) | Xóa câu hỏi (kiểm tra reference) | 0.25d | 4.1 |
| 4.7 | Validation: ≥2 options, đúng 1 `is_correct` | Lỗi rõ ràng khi thiếu | 0.25d | 4.2 |
| 4.8 | E2e tests: question bank CRUD + authorization | | 0.5d | 4.2–4.6 |

**Deliverable**: Giáo viên quản lý ngân hàng câu hỏi trắc nghiệm. `is_correct` không bao giờ lộ cho học sinh.

---

## 4A. File Upload & Image Support — 3–4 ngày

> **Mục tiêu**: Giáo viên upload ảnh vào câu hỏi và đáp án. Học sinh xem ảnh khi làm bài.

| ID | Task | Output | Effort | Phụ thuộc |
|---|---|---|---|---|
| 4A.1 | Setup MinIO (S3-compatible) trong Docker Compose | Service MinIO chạy, bucket `lumi-uploads` tạo sẵn | 0.5d | 1.5 |
| 4A.2 | Upload module backend | `src/modules/uploads/` — UploadController, UploadService. Config S3 client (`@aws-sdk/client-s3`) | 0.5d | 4A.1 |
| 4A.3 | `POST /uploads/images` — upload ảnh | Accept multipart, validate type (jpg/png/webp/gif), max 5MB. Sinh unique key, upload lên S3. Trả `{ url, key }` | 1d | 4A.2 |
| 4A.4 | Serve ảnh qua signed URL hoặc public bucket | Quyết định: public read (đơn giản) hoặc signed URL (bảo mật hơn). MVP đề xuất public read cho bucket `lumi-uploads` | 0.25d | 4A.3 |
| 4A.5 | Cập nhật Question model — hỗ trợ ảnh | `questions.content` và `question_options.content` chứa Markdown hoặc HTML với `![](image_url)`. Không thay đổi schema — content đã là text, ảnh là URL nhúng | 0.25d | 4.2, 4A.3 |
| 4A.6 | Frontend: upload component | Nút upload ảnh trong form tạo/sửa câu hỏi. Preview ảnh. Insert URL vào content | 0.75d | 4A.3 |
| 4A.7 | Frontend: render ảnh trong đề thi | Hiển thị ảnh inline trong câu hỏi và đáp án khi làm bài | 0.25d | 4A.5 |
| 4A.8 | E2e tests: upload + hiển thị | Upload ảnh → tạo câu hỏi có ảnh → student thấy ảnh khi làm bài | 0.25d | 4A.3–4A.7 |

**Deliverable**: Giáo viên upload ảnh vào câu hỏi/đáp án, học sinh xem ảnh trong đề thi. Ảnh lưu trên MinIO (S3-compatible).

---

## 4B. Google Docs Import — 4–5 ngày

> **Mục tiêu**: Giáo viên import đề thi từ Google Docs. Hệ thống parse tự động thành câu hỏi + đáp án.
>
> **Approach**: Teacher export Google Doc → `.docx` file → upload lên hệ thống → backend parse → tạo questions.
> Không dùng Google Docs API (tránh OAuth phức tạp). Teacher chỉ cần File → Download → .docx.

| ID | Task | Output | Effort | Phụ thuộc |
|---|---|---|---|---|
| 4B.1 | Định nghĩa format mẫu đề thi | Template Google Docs với convention: `Câu 1.`, `A.`, `B.`, `C.`, `D.`, đánh dấu đáp án đúng bằng `*` hoặc bold. Tài liệu hướng dẫn cho teacher | 0.5d | — |
| 4B.2 | `.docx` parser service | `src/modules/question-bank/import/docx-parser.service.ts`. Dùng `mammoth` (docx → HTML) hoặc `docx` lib. Extract: text, images, formatting | 1d | 4B.1 |
| 4B.3 | Question extractor logic | Parse HTML/text output từ 4B.2. Nhận diện: câu hỏi (pattern `Câu X.` hoặc numbering), options (`A.`/`B.`/`C.`/`D.`), đáp án đúng (bold/`*`/highlight). Trả structured `{ questions: [{ content, options: [{ content, is_correct }] }] }` | 1.5d | 4B.2 |
| 4B.4 | Extract và upload ảnh từ .docx | Khi parse, extract embedded images → upload lên S3 (dùng upload service từ 4A) → thay thế reference trong content bằng URL | 0.5d | 4B.2, 4A.3 |
| 4B.5 | `POST /questions/import` endpoint | TEACHER only. Accept `.docx` multipart upload. Parse → preview danh sách câu hỏi extracted (chưa save). Trả `{ questions: [...], warnings: [...] }` | 0.5d | 4B.3, 4B.4 |
| 4B.6 | `POST /questions/import/confirm` endpoint | TEACHER nhận preview, có thể sửa, rồi confirm. Backend batch-create questions + options | 0.25d | 4B.5 |
| 4B.7 | Frontend: import flow | Trang import: upload .docx → xem preview → sửa nếu cần → confirm. Hiển thị warnings (câu thiếu đáp án, format không nhận diện được) | 1d | 4B.5, 4B.6 |
| 4B.8 | E2e tests + edge cases | File trống, format sai, thiếu đáp án, ảnh embedded, Unicode tiếng Việt | 0.5d | 4B.5 |

**Format mẫu Google Docs** (hướng dẫn cho teacher):

```
Câu 1. Thủ đô của Việt Nam là gì?
A. TP Hồ Chí Minh
B. Đà Nẵng
*C. Hà Nội
D. Huế

Câu 2. 2 + 2 = ?
A. 3
*B. 4
C. 5
D. 6
```

> `*` trước option = đáp án đúng. Ảnh inline trong doc sẽ được extract tự động.

**Deliverable**: Teacher export Google Docs thành .docx, upload, hệ thống parse tự động thành câu hỏi. Có preview để sửa trước khi lưu.

---

## 5. Exam Management — 4–5 ngày

| ID | Task | Output | Effort | Phụ thuộc |
|---|---|---|---|---|
| 5.1 | Prisma migration: `exams` + `exam_questions` | Bảng với status enum, content_snapshot, options_snapshot JSONB | 0.5d | 4.1 |
| 5.2 | `POST /exams` (TEACHER) | Tạo exam DRAFT | 0.5d | 5.1 |
| 5.3 | `GET /exams`, `GET /exams/:id` | Danh sách + chi tiết exam với questions | 0.5d | 5.1 |
| 5.4 | `PATCH /exams/:id` (DRAFT only) | Cập nhật tiêu đề, thời lượng, cửa sổ mở đóng | 0.25d | 5.1 |
| 5.5 | `POST /exams/:id/questions` (DRAFT only) | Thêm câu hỏi từ question bank vào exam | 0.5d | 5.1, 4.1 |
| 5.6 | `DELETE /exams/:id/questions/:eqId` | Xóa câu hỏi khỏi exam DRAFT | 0.25d | 5.5 |
| 5.7 | `PATCH /exams/:id/questions/:eqId` | Cập nhật points, position | 0.25d | 5.5 |
| 5.8 | `POST /exams/:id/publish` — snapshot logic | Transaction: copy content → content_snapshot, options → options_snapshot cho mọi exam_question. Status → PUBLISHED | 1d | 5.5 |
| 5.9 | Validation: ≥1 question, duration > 0, points > 0 | Không publish được nếu thiếu | 0.25d | 5.8 |
| 5.10 | E2e tests: exam lifecycle + snapshot verification | Tạo → thêm câu hỏi → publish → verify snapshot độc lập | 0.75d | 5.2–5.8 |

**Deliverable**: Giáo viên tạo exam, thêm câu hỏi, publish. Snapshot đảm bảo bài thi không thay đổi sau khi publish.

---

## 6. Assignment Flow — 2–3 ngày

| ID | Task | Output | Effort | Phụ thuộc |
|---|---|---|---|---|
| 6.1 | Prisma migration: `assignments` | Unique (exam_id, classroom_id) | 0.25d | 5.1, 3.1 |
| 6.2 | `POST /exams/:id/assignments` (TEACHER) | Giao exam PUBLISHED cho classroom mình sở hữu | 0.5d | 6.1 |
| 6.3 | `GET /assignments` | Teacher: theo exam. Student: theo classroom membership | 0.5d | 6.1 |
| 6.4 | `GET /assignments/:id` | Chi tiết assignment, kiểm tra quyền | 0.25d | 6.1 |
| 6.5 | E2e tests: assignment flow + authorization | Giao → student thấy → không giao draft → không giao lớp khác | 0.5d | 6.2–6.4 |

**Deliverable**: Giáo viên giao bài cho lớp, học sinh xem danh sách bài được giao.

---

## 7. Exam Attempt Engine — 8–10 ngày

> **Đây là phần phức tạp nhất, cần test kỹ concurrency.**

| ID | Task | Output | Effort | Phụ thuộc |
|---|---|---|---|---|
| 7.1 | Prisma migration: `exam_attempts` + `answers` | Bảng với unique constraints, index (exam_id, student_id) | 0.5d | 5.1, 6.1 |
| 7.2 | `POST /exams/:examId/attempts` — start attempt | Validate: membership, published, time window, max_attempts, no duplicate IN_PROGRESS. Tạo attempt với `started_at`, `expires_at` do server tính | 1.5d | 7.1 |
| 7.3 | Concurrency control cho start attempt | `SELECT FOR UPDATE` hoặc unique partial index `(exam_id, student_id) WHERE status = 'IN_PROGRESS'`. Test concurrent start | 1d | 7.2 |
| 7.4 | `GET /attempts/:id` — student view | Trả questions từ snapshot, **strip `is_correct`**. Kèm saved answers | 0.75d | 7.1 |
| 7.5 | Lazy expiry check service | `checkAndAutoSubmit(attempt)`: nếu `NOW() > expires_at` và status = IN_PROGRESS → trigger auto-submit + grading | 1d | 7.1 |
| 7.6 | `PUT /attempts/:id/answers/:examQuestionId` — autosave | Validate attempt IN_PROGRESS + chưa hết giờ. Upsert answer. Trả `{ saved_at }` | 1d | 7.1, 7.5 |
| 7.7 | `POST /attempts/:id/submit` — idempotent submit | Transaction + SELECT FOR UPDATE. Nếu SUBMITTED → trả kết quả cũ. Nếu IN_PROGRESS → grade + submit | 1.5d | 7.6, 8.1 |
| 7.8 | Auto-submit on expiry integration | Lazy check gọi cùng logic submit, transition thành SUBMITTED (không phải EXPIRED) | 0.5d | 7.5, 7.7 |
| 7.9 | Unit tests: state machine, expiry logic, validation | | 0.5d | 7.2–7.8 |
| 7.10 | E2e tests: full attempt flow | Start → autosave → submit → verify. Hết giờ → auto-submit. Concurrent submit → 1 kết quả | 1d | 7.2–7.8 |
| 7.11 | Concurrent submit stress test | 5 submit đồng thời → assert 1 lần chấm, cùng điểm | 0.5d | 7.7 |

**Deliverable**: Engine làm bài hoàn chỉnh — start, autosave, submit, auto-submit khi hết giờ, an toàn concurrency.

---

## 8. Grading & Results — 4–5 ngày

| ID | Task | Output | Effort | Phụ thuộc |
|---|---|---|---|---|
| 8.1 | GradingService: chấm MCQ | So sánh `selected_option_id` với `is_correct` trong `options_snapshot`. Tính điểm = tổng points câu đúng | 0.75d | 5.1 |
| 8.2 | Unit tests: grading logic | Tất cả đúng, tất cả sai, một phần, không trả lời | 0.5d | 8.1 |
| 8.3 | `GET /attempts/:id/result` (STUDENT owner) | Kiểm tra `show_result_immediately`. Trả score, total, per-question breakdown (question, answer, correct answer, points) | 0.75d | 7.7 |
| 8.4 | `GET /exams/:id/results` (TEACHER owner) | Danh sách attempts: student name, score, status, thời gian. Pagination. Tổng hợp: trung bình, completion rate | 1d | 7.7 |
| 8.5 | `GET /classrooms/:id/results` (TEACHER owner) | Tổng hợp theo classroom: mỗi assignment → số bài, điểm trung bình | 0.5d | 8.4 |
| 8.6 | E2e tests: result visibility + teacher views | Student xem khi được phép, không xem khi bị ẩn. Teacher xem tất cả. Authorization | 0.75d | 8.3–8.5 |

**Deliverable**: Chấm điểm tự động, học sinh xem kết quả (theo chính sách), giáo viên xem kết quả lớp.

---

## 9. Frontend Application — 10–12 ngày

> **Design system**: `docs/LMS_BRAND_COLOR_SYSTEM.md` — Trustworthy Blue brand
> **Stack**: Next.js + Tailwind CSS + shadcn/ui
> **Approach**: Mobile-first responsive, light/dark theme, WCAG AA contrast
> **Nguyên tắc**: Neutral-first UI, Blue cho primary actions, Exam UI calm & distraction-free

| ID | Task | Output | Effort | Phụ thuộc |
|---|---|---|---|---|
| 9.1 | **Tailwind + shadcn/ui setup + brand tokens** | Cấu hình CSS variables theo brand system (light + dark theme). Map shadcn theme tokens sang brand palette. `globals.css` với `:root` và `.dark` tokens | 1d | 1.3 |
| 9.2 | Auth pages + token management | Login, register (mobile-first forms). Interceptor refresh token. Protected route middleware | 1.5d | 2.*, 9.1 |
| 9.3 | Layout + navigation | Responsive sidebar (collapse thành bottom nav trên mobile). Header theo role. Theme switcher (light/dark) | 1d | 9.2 |
| 9.4 | Dashboard | Teacher: classrooms + exams cards. Student: classrooms + bài được giao. Primary Blue cho CTA. Neutral surfaces | 1d | 9.3 |
| 9.5 | Classroom pages | Tạo lớp, xem lớp + mã (copy to clipboard), join lớp, danh sách thành viên. Responsive table/list | 1d | 3.* |
| 9.6 | Question bank pages | Danh sách, tạo/sửa form với options + image upload, import .docx flow. Xóa | 1.5d | 4.*, 4A.*, 4B.* |
| 9.7 | Exam management pages | Tạo exam, thêm/xóa câu hỏi, cấu hình, publish. Card-based question list | 1.5d | 5.* |
| 9.8 | Assignment + student exam list | Giao bài (teacher), danh sách bài cho student với trạng thái (badges: semantic colors) | 0.5d | 6.* |
| 9.9 | **Exam-taking view** (ưu tiên cao nhất) | Neutral background, question workspace. Selected answer = subtle blue tint + primary border. Timer countdown từ `expires_at`, warning amber ≤5min, error red ≤1min. Autosave (debounce 3s) + indicator. Auto-submit khi hết giờ. Question navigation responsive | 2d | 7.* |
| 9.10 | Result pages | Student: điểm + per-question breakdown (success green = đúng, error red = sai). Teacher: results table + summary stats. Cyan cho progress/charts | 1d | 8.* |
| 9.11 | Error handling, loading states, toasts | Skeleton, error boundary, toast notifications. Disabled state styling. Both themes verified | 0.5d | 9.1–9.10 |

**Deliverable**: Giao diện web hoàn chỉnh cho tất cả luồng chính.

---

## 10. Deployment & Operations — 4–5 ngày

| ID | Task | Output | Effort | Phụ thuộc |
|---|---|---|---|---|
| 10.1 | Production Docker Compose | `docker-compose.prod.yml`, multi-stage Dockerfile, resource limits | 0.5d | 1.5 |
| 10.2 | PgBouncer connection pooling | Config cho 100 concurrent users | 0.5d | 10.1 |
| 10.3 | Nginx: TLS (Let's Encrypt), gzip, rate limiting, security headers | HTTPS hoạt động, rate limit tested | 0.5d | 10.1 |
| 10.4 | Database backup script + cron | pg_dump hàng ngày, giữ 7 daily + 4 weekly | 0.5d | 10.1 |
| 10.5 | Restore procedure — test thực tế | Restore vào test DB thành công, có tài liệu | 0.25d | 10.4 |
| 10.6 | Structured logging (pino) + log rotation | Logs JSON, không mất log khi đầy disk | 0.25d | 1.2 |
| 10.7 | Health check + basic monitoring | Uptime monitoring, alert khi down | 0.25d | 1.2 |
| 10.8 | k6 load test script | Mô phỏng 100 concurrent: login → list → start → autosave × 5 → submit | 1d | 7.*, 8.* |
| 10.9 | Load test chạy + fix bottleneck | Chạy k6, xác định và fix nếu có | 0.5d | 10.8 |
| 10.10 | README + operations documentation | Setup, deploy, backup/restore, env vars, troubleshoot | 0.5d | All |

**Deliverable**: Production-ready, backup tự động, load test pass 100 concurrent users.

---

## Tổng hợp

| # | Phase | Effort | Phụ thuộc |
|---|---|---|---|
| 1 | Project Setup & Infrastructure | 3–4d | — |
| 2 | Authentication & User Management | 5–6d | 1 |
| 3 | Classroom Management | 3–4d | 2 |
| 4 | Question Bank | 3–4d | 2 |
| 4A | File Upload & Image Support | 3–4d | 1.5, 4 |
| 4B | Google Docs Import | 4–5d | 4, 4A |
| 5 | Exam Management | 4–5d | 4 |
| 6 | Assignment Flow | 2–3d | 3, 5 |
| 7 | Exam Attempt Engine | 8–10d | 6, 8.1 |
| 8 | Grading & Results | 4–5d | 7 |
| 9 | Frontend Application | 10–12d | 2–8 (incremental) |
| 10 | Deployment & Operations | 4–5d | All |
| | **Tổng** | **53–70d** | |

### Critical Path

```
1 → 2 → 4 → 4A → 4B ──→ 5 → 6 → 7 → 8 → 10
              ↗ (parallel)
         3 ──┘
```

- **Phase 3 (Classroom)** và **Phase 4 (Question Bank)** có thể làm song song vì đều chỉ phụ thuộc Phase 2.
- **Phase 4A (Image)** cần Phase 4 xong. **Phase 4B (Docs Import)** cần 4A (để upload ảnh embedded).
- **Phase 5 (Exam)** có thể bắt đầu song song với 4B nếu 4 đã xong (5 không cần import).
- **Phase 9 (Frontend)** bắt đầu từ Phase 2, làm xen kẽ theo từng module backend.
- **Critical path**: 1 → 2 → 4 → 4A → 4B → 5 → 6 → 7 → 8 → 10 = **40–52 ngày** (frontend song song).

### Ghi chú về ước lượng

- 1 dev-day = 7 giờ làm việc hiệu quả
- Bao gồm viết test cho từng task
- Chưa tính: review, product discussion, UI design chi tiết, bug fix sau QA
- Nếu 2 developers: dev A backend, dev B frontend (bắt đầu từ Phase 2) → ước lượng giảm còn ~35–42 ngày lịch
