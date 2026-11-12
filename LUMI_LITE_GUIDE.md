# Lumi — Product & Technical Guide

> Tài liệu định hướng MVP để Claude đọc repository (nếu có) và lập implementation plan.
> Mục tiêu: xây dựng nền tảng giao bài tập/kiểm tra trực tuyến lấy cảm hứng từ nhóm chức năng của Azota, nhưng tự thiết kế sản phẩm, UI, nội dung và mã nguồn.

## 1. Product goal

Xây dựng một phiên bản LMS/online examination gọn nhẹ, ưu tiên hoàn thành luồng học tập cốt lõi trước khi mở rộng.

- Quy mô mục tiêu ban đầu: khoảng **100 users**.
- Tạm lấy giả định thiết kế: **100 người dùng hoạt động đồng thời ở mức tải cơ bản**. Cần xác nhận lại đây là 100 tài khoản hay 100 concurrent users trước khi chốt sizing.
- Ưu tiên: dễ phát triển, dễ vận hành, ít thành phần hạ tầng, dữ liệu nhất quán.
- Kiến trúc khởi đầu: **Modular Monolith**, không chia microservices.

## 2. Scope MVP

### 2.1 Chức năng trong MVP

1. **Authentication & user**
   - Đăng ký/đăng nhập/đăng xuất.
   - JWT access token và refresh token.
   - Hồ sơ người dùng cơ bản.
   - Phân quyền theo role.

2. **Classroom**
   - Giáo viên tạo lớp.
   - Học sinh tham gia lớp bằng mã mời/mã lớp.
   - Giáo viên xem danh sách thành viên.

3. **Question bank**
   - Tạo, sửa, xóa câu hỏi.
   - Loại câu hỏi MVP: trắc nghiệm một đáp án; có thể thêm tự luận nếu cần.
   - Lưu đáp án đúng ở backend; không gửi đáp án đúng xuống client trước khi nộp bài.

4. **Exam / assignment**
   - Giáo viên tạo bài kiểm tra.
   - Thêm câu hỏi từ question bank.
   - Cấu hình thời gian làm bài và thời gian mở/đóng bài.
   - Giao bài cho một lớp.
   - Học sinh xem danh sách bài được giao và trạng thái.

5. **Exam attempt**
   - Học sinh bắt đầu làm bài.
   - Backend tạo attempt và ghi nhận thời điểm bắt đầu.
   - Học sinh trả lời; frontend tự động lưu câu trả lời.
   - Học sinh nộp bài.
   - Backend kiểm tra thời hạn và trạng thái attempt.
   - Submit phải idempotent: gửi lặp không tạo nhiều kết quả hoặc chấm điểm nhiều lần.

6. **Grading & results**
   - Tự động chấm câu hỏi trắc nghiệm.
   - Lưu điểm và trạng thái bài làm.
   - Học sinh xem kết quả theo chính sách công bố của bài thi.
   - Giáo viên xem kết quả của lớp/bài kiểm tra.

### 2.2 Chưa làm trong MVP

Không triển khai các mục sau trừ khi có lý do nghiệp vụ bắt buộc:

- Microservices, Kafka, event-driven distributed architecture.
- Elasticsearch / OpenSearch.
- AI grading, OCR nâng cao, xử lý ảnh phức tạp.
- Realtime proctoring, webcam monitoring, browser lockdown.
- Anti-cheat nâng cao. Có thể ghi nhận tín hiệu cơ bản nhưng không coi đó là bằng chứng gian lận.
- Gamification, leaderboard.
- Payment, subscription, billing.
- Parent dashboard.
- Mobile native app.
- Multi-region, Kubernetes, autoscaling phức tạp.
- Hệ thống notification phức tạp. MVP có thể dùng in-app status hoặc email đơn giản nếu thật sự cần.

## 3. Roles — cần xác nhận

Phương án tối thiểu đề xuất:

- `TEACHER`: tạo lớp, quản lý câu hỏi, tạo/giao bài, xem kết quả.
- `STUDENT`: tham gia lớp, làm bài, xem kết quả được phép công bố.
- `ADMIN`: quản trị user/lớp và hỗ trợ vận hành; chỉ thêm nếu sản phẩm cần quản trị tập trung.

Claude không được tự quyết định có `ADMIN` hay không. Hãy nêu rõ trade-off và đánh dấu đây là quyết định cần owner xác nhận. Có thể thiết kế role enum để dễ bổ sung, nhưng không xây dựng admin dashboard nếu chưa được duyệt.

## 4. Suggested technology stack

Ưu tiên công nghệ quen thuộc, đơn giản, dễ triển khai:

| Layer | Suggested choice | Notes |
|---|---|---|
| Frontend | Next.js + TypeScript | Responsive web app |
| Backend | NestJS + Fastify hoặc Express | Modular monolith |
| ORM | Prisma | Dùng migration có kiểm soát |
| Database | PostgreSQL | Source of truth |
| Cache / rate limit | Chưa cần lúc đầu; Redis optional | Chỉ thêm khi có use case cụ thể |
| File storage | S3-compatible object storage | Chỉ cần nếu upload file là MVP requirement |
| Background jobs | Chưa cần; BullMQ optional | Không đưa vào chỉ để “phòng xa” |
| Deployment | Docker Compose + Nginx trên một VPS | Tách database managed nếu ngân sách cho phép |
| Testing | Jest + Supertest; k6 cho load test | Test luồng nghiệp vụ và tải |

Nếu repository hiện tại đã dùng stack khác, hãy ưu tiên đánh giá và tận dụng stack hiện có thay vì đề xuất rewrite.

## 5. Suggested backend modules

```text
src/
  modules/
    auth/
    users/
    classrooms/
    question-bank/
    exams/
    attempts/
    grading/
  common/
    guards/
    decorators/
    filters/
    interceptors/
    pipes/
  database/
  config/
  main.ts
```

Không cần tạo module riêng cho mọi bảng. Chỉ tách theo domain/use case có ý nghĩa.

## 6. Initial data model

Đây là mô hình khởi đầu để Claude đánh giá và tinh chỉnh, không phải schema bắt buộc cuối cùng.

### Core tables

- `users`
  - `id`, `email`, `password_hash`, `display_name`, `role`, timestamps.
- `classrooms`
  - `id`, `name`, `join_code`, `owner_id`, timestamps.
- `classroom_members`
  - `id`, `classroom_id`, `user_id`, `joined_at`.
  - Unique constraint `(classroom_id, user_id)`.
- `questions`
  - `id`, `owner_id`, `type`, `content`, `explanation`, timestamps.
- `question_options`
  - `id`, `question_id`, `content`, `is_correct`, `position`.
  - Không expose `is_correct` trong API dành cho học sinh trước khi được phép.
- `exams`
  - `id`, `owner_id`, `title`, `description`, `duration_seconds`, `available_from`, `available_until`, `status`, timestamps.
- `exam_questions`
  - `id`, `exam_id`, `question_id`, `points`, `position`.
  - Cần quyết định có snapshot nội dung câu hỏi tại thời điểm publish hay không. Khuyến nghị snapshot để sửa question bank không làm thay đổi bài thi đã giao.
- `assignments`
  - `id`, `exam_id`, `classroom_id`, `assigned_at`, `due_at`, `status`.
- `exam_attempts`
  - `id`, `exam_id`, `student_id`, `started_at`, `expires_at`, `submitted_at`, `status`, `score`.
  - Unique/index phù hợp với policy số lần làm bài.
- `answers`
  - `id`, `attempt_id`, `exam_question_id`, `answer_payload`, `saved_at`.
  - Unique constraint `(attempt_id, exam_question_id)` để upsert/autosave.

### Data-model decisions Claude must resolve

- Một học sinh được làm lại bao nhiêu lần?
- Có cho phép giáo viên công bố đáp án/điểm ngay sau khi nộp không?
- Bài thi cần snapshot câu hỏi và đáp án ở thời điểm publish như thế nào?
- Một exam có thể được giao cho nhiều lớp không?
- Có cần tự luận trong MVP không? Nếu có, kết quả cần trạng thái chờ chấm thủ công.

Không tạo thêm bảng hoặc abstraction nếu chưa có use case rõ ràng.

## 7. Main workflows

### 7.1 Teacher creates and assigns an exam

1. Teacher tạo exam ở trạng thái `DRAFT`.
2. Teacher thêm câu hỏi và cấu hình điểm/thời lượng.
3. Teacher publish exam.
4. Teacher giao exam cho classroom.
5. Backend kiểm tra quyền sở hữu classroom/exam và trạng thái exam.

### 7.2 Student takes an exam

1. Student xem bài được giao.
2. Student gọi start attempt.
3. Backend xác minh membership, assignment window, exam status và attempt policy.
4. Backend tạo attempt với `started_at` và `expires_at` do server xác định.
5. Student lấy nội dung đề thi nhưng không nhận đáp án đúng.
6. Student autosave câu trả lời qua API.
7. Student submit; backend xác minh attempt và chấm điểm.
8. Student xem kết quả nếu policy cho phép.

### 7.3 Important correctness rules

- Server là nguồn sự thật cho thời gian bắt đầu/kết thúc; không tin đồng hồ client.
- Không cho sửa câu trả lời sau khi attempt đã submit/expired.
- Autosave dùng upsert hoặc cơ chế tương đương, tránh tạo nhiều answer rows.
- Submit phải idempotent; submit lặp trả về kết quả hiện có.
- Backend phải xử lý request đồng thời cho cùng một attempt an toàn.
- Khi client mất mạng, client có thể gửi lại câu trả lời; backend cần xử lý retry an toàn.
- Chỉ trả dữ liệu cần thiết cho role hiện tại; không lộ đáp án đúng hoặc dữ liệu nội bộ.
- Ghi nhận audit tối thiểu cho start, answer save, submit và grading.
- Xác định rõ trạng thái attempt, ví dụ: `IN_PROGRESS`, `SUBMITTED`, `EXPIRED`, `CANCELLED`.
- Cần định nghĩa rõ hành vi khi thời gian hết nhưng client chưa submit: backend tự đánh dấu hết hạn khi request tiếp theo đến, hoặc có job định kỳ nếu thực sự cần. Không bắt buộc scheduler cho MVP nếu có thể xử lý lazy expiration an toàn.

## 8. Initial API outline

Tên endpoint chỉ là gợi ý. Claude cần kiểm tra conventions của repository trước khi chốt.

### Auth
- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/logout`
- `GET /users/me`

### Classroom
- `POST /classrooms`
- `GET /classrooms`
- `GET /classrooms/:id`
- `POST /classrooms/:id/join`
- `GET /classrooms/:id/members`

### Question bank
- `POST /questions`
- `GET /questions`
- `GET /questions/:id`
- `PATCH /questions/:id`
- `DELETE /questions/:id`

### Exam & assignment
- `POST /exams`
- `GET /exams/:id`
- `PATCH /exams/:id`
- `POST /exams/:id/publish`
- `POST /exams/:id/assignments`
- `GET /assignments`

### Attempts
- `POST /exams/:id/attempts`
- `GET /attempts/:id`
- `PUT /attempts/:id/answers/:examQuestionId`
- `POST /attempts/:id/submit`
- `GET /attempts/:id/result`
- `GET /exams/:id/results`

## 9. Deployment starting point

For a small MVP, begin with one application server:

- VPS: roughly 2–4 vCPU, 4–8 GB RAM, SSD.
- Docker Compose: frontend, backend, PostgreSQL (or managed PostgreSQL), Nginx.
- Object storage only if file uploads are in scope.
- Automated database backups and a tested restore procedure are required before production use.
- TLS, environment-based secrets, health checks, log rotation and basic monitoring.
- Do not treat this sizing as a guarantee. Validate with a representative load test.

## 10. Testing / acceptance criteria

At minimum, cover:

- Authentication and role authorization.
- Teacher cannot modify another teacher's classroom/exam.
- Student cannot access an exam not assigned to their classroom.
- Student cannot start outside allowed time.
- Server-enforced attempt expiry.
- Correct autosave and retry behavior.
- Concurrent duplicate submit requests produce one final result.
- Submitted/expired attempts cannot be modified.
- Correct grading for all supported question types.
- Correct result visibility rules.
- Database migration and backup/restore smoke test.

Load-test scenarios should model realistic behavior rather than only hitting one endpoint:
- Login/session creation.
- Listing assignments.
- Starting attempts.
- Autosaving answers at intervals.
- Submitting attempts.
- Teacher viewing results.

## 11. Decisions still needed from product owner

Claude should produce a short decision list, not silently invent answers:

1. “100 users” means 100 registered accounts or 100 concurrent active users?
2. Roles: `TEACHER + STUDENT` only, or include `ADMIN`?
3. MVP includes both homework and timed exams, or only one of them?
4. Question types: multiple-choice only, or include essay/manual grading?
5. Retake policy: one attempt or configurable multiple attempts?
6. Is file/image upload required in the first release?

Where a decision does not block architecture planning, Claude should state a reasonable provisional assumption and continue.

## 12. Implementation principles

- Build the smallest complete vertical slice first.
- Prefer readable code and explicit domain rules over generic frameworks.
- Avoid speculative abstractions and premature optimization.
- Keep PostgreSQL as the source of truth.
- Use transactions for operations that update multiple related records.
- Add indexes based on actual query patterns and foreign keys.
- Validate input at API boundaries.
- Enforce authorization in backend use cases/services, not only in frontend.
- Add tests for business-critical state transitions.
- Document assumptions and unresolved questions.
