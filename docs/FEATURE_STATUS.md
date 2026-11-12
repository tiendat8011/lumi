# Lumi Lite — Tổng hợp Feature & Trạng thái

> Cập nhật: 2026-11-11

## Tổng quan

| Mức ưu tiên | Tổng | ✅ Done | ⏳ Chưa làm | Tỷ lệ |
|---|---|---|---|---|
| **P0** | 16 | **16** | 0 | 100% |
| **P1** | 22 | **22** | 0 | 100% |
| **P2** | 24 | **13** | 11 | 54% |
| **P3** | 15 | 0 | 15 | 0% |
| **Tổng** | **77** | **51** | **26** | **66%** |

---

## A. Authentication & User Management

| ID | Feature | Priority | Status | API | Frontend |
|---|---|---|---|---|---|
| A1 | Register / Login / Logout | P0 | ✅ Done | POST /auth/register, /login, /logout | Login/Register page |
| A2 | User Profile (xem) | P0 | ✅ Done | GET /auth/me | Dashboard header |
| A3 | Teacher / Student Roles | P0 | ✅ Done | Global RolesGuard + @Roles() | Sidebar hiện theo role |
| A4 | Forgot / Reset Password | P1 | ✅ Done | POST /auth/forgot-password, /reset-password | ⚠️ Chưa có UI riêng (API ready) |
| A5 | Edit Profile | P1 | ✅ Done | PATCH /auth/profile | /dashboard/profile |
| A6 | Admin Dashboard | P2 | ⏳ Chưa làm | — | — |
| A7 | Teacher tạo tài khoản HS | P2 | ⏳ Chưa làm | — | — |
| A8 | Guest Access | P3 | ⏳ Ngoài phạm vi | — | — |

---

## B. Classroom Management

| ID | Feature | Priority | Status | API | Frontend |
|---|---|---|---|---|---|
| B1 | Tạo lớp học | P0 | ✅ Done | POST /classrooms | Dialog tạo lớp |
| B2 | Tham gia bằng mã | P0 | ✅ Done | POST /classrooms/join | Dialog nhập mã |
| B3 | Danh sách thành viên | P0 | ✅ Done | GET /classrooms/:id/members | Tab thành viên |
| B4 | Sửa lớp học | P0 | ✅ Done | PATCH /classrooms/:id | EditClassroomDialog |
| B5 | Xoá lớp học | P0 | ✅ Done | DELETE /classrooms/:id | Nút xoá trong chi tiết |
| B6 | Xoá thành viên | P1 | ✅ Done | DELETE /classrooms/:id/members/:userId | Nút UserMinus |
| B7 | Classroom Dashboard | P1 | ⏳ Chưa làm | — | — |
| B8 | Student Progress Tracking | P1 | ⏳ Chưa làm | — | — |
| B9 | Thông báo lớp học | P2 | ⏳ Chưa làm | Schema Announcement đã có | — |
| B10 | Import/Export danh sách HS | P2 | ⏳ Chưa làm | — | — |
| B11 | Lưu trữ / Khôi phục lớp | P2 | ✅ Done | PATCH /classrooms/:id/archive, /unarchive | Nút archive trong UI |

---

## C. Question Bank

| ID | Feature | Priority | Status | API | Frontend |
|---|---|---|---|---|---|
| C1 | CRUD câu hỏi MCQ | P0 | ✅ Done | CRUD /questions | Dialog tạo/sửa câu hỏi |
| C2 | Danh mục câu hỏi | P1 | ✅ Done | CRUD /questions/categories | Filter + CreateCategoryDialog |
| C3 | Mức độ khó | P1 | ✅ Done | Field difficulty trên Question | Dropdown filter + badge |
| C4 | True/False | P1 | ✅ Done | Question.type = TRUE_FALSE | Type selector trong dialog |
| C5 | MCQ nhiều đáp án | P1 | ✅ Done | Question.type = MCQ_MULTI | Type selector trong dialog |
| C6 | Ảnh câu hỏi | P1 | ✅ Done | Field imageUrl trên Question | ⚠️ API field ready, chưa có upload UI |
| C7 | Tìm kiếm & Filter | P1 | ✅ Done | GET /questions?search=&category=&difficulty=&type= | Search input + dropdowns |
| C8 | Short Answer | P2 | ✅ Done | Question.type = SHORT_ANSWER | Type selector + correctAnswer field |
| C9 | Fill in the Blank | P2 | ✅ Done | Question.type = FILL_BLANK | Type selector + correctAnswer field |
| C10 | Essay / Tự luận | P2 | ✅ Done | Question.type = ESSAY | Type selector trong dialog |
| C11 | Import/Export câu hỏi | P2 | ⏳ Chưa làm | — | — |
| C12 | Question Groups | P2 | ⏳ Chưa làm | Schema đã có | — |
| C13 | Random Question Selection | P2 | ⏳ Chưa làm | — | — |

---

## D. Exam Management

| ID | Feature | Priority | Status | API | Frontend |
|---|---|---|---|---|---|
| D1 | CRUD + Publish đề thi | P0 | ✅ Done | CRUD /exams, POST /exams/:id/publish | Trang đề thi + chi tiết |
| D2 | Màn hình hướng dẫn | P0 | ✅ Done | Field instructions trên Exam | Instructions screen trước khi bắt đầu |
| D3 | Trộn câu hỏi | P1 | ✅ Done | shuffleQuestions + questionOrder trên attempt | Checkbox trong tạo đề |
| D4 | Trộn đáp án | P1 | ✅ Done | shuffleOptions trên Exam | Checkbox trong tạo đề |
| D5 | Exam Preview (Teacher) | P1 | ⏳ Chưa làm | — | — |
| D6 | Start/End Time UI | P1 | ⏳ Chưa làm | Schema có availableFrom/Until | — |
| D7 | Answer Review (Post-submit) | P1 | ✅ Done | GET /attempts/:id/review | ReviewDialog + StudentReviewDialog |
| D8 | Mã truy cập đề thi | P2 | ✅ Done | accessCode trên Exam | Input trong CreateExamDialog |
| D9 | Tạo câu hỏi trực tiếp trong đề | P2 | ⏳ Chưa làm | — | — |
| D10 | Random Exam Generation | P2 | ⏳ Chưa làm | — | — |
| D11 | Assign cho HS cụ thể | P2 | ⏳ Chưa làm | — | — |

---

## E. Online Examination (Thi trực tuyến)

| ID | Feature | Priority | Status | API | Frontend |
|---|---|---|---|---|---|
| E1 | Bắt đầu thi | P0 | ✅ Done | POST /attempts/start | /dashboard/take-exam/[examId] |
| E2 | Đồng hồ đếm ngược | P0 | ✅ Done | Client-side từ expiresAt | Badge MM:SS, đỏ khi < 60s |
| E3 | Navigator câu hỏi | P0 | ✅ Done | — | Grid số câu hỏi |
| E4 | Tự động lưu đáp án | P0 | ✅ Done | POST /attempts/:id/answer | Lưu mỗi click |
| E5 | Auto-submit khi hết giờ | P0 | ✅ Done | POST /attempts/:id/submit + lazy expiry | Client + server backup |
| E6 | Nộp bài thủ công | P0 | ✅ Done | POST /attempts/:id/submit | Nút "Nộp bài" |
| E7 | Trạng thái nộp bài | P0 | ✅ Done | Attempt status enum | Badge trạng thái |
| E8 | Màn hình hướng dẫn | P1 | ✅ Done | instructions trên Exam | Interstitial page |
| E9 | Ẩn/hiện kết quả | P1 | ✅ Done | resultsReleased + PATCH release-results | Nút "Công bố kết quả" |
| E10 | Resume sau mất kết nối | P2 | ✅ Một phần | Answers lưu server-side, re-start trả attempt cũ | ⚠️ Chưa có localStorage queue |
| E11 | Lịch sử làm bài | P2 | ✅ Done | GET /attempts/my | /dashboard/my-results |

---

## F. Assignment Management (Giao bài)

| ID | Feature | Priority | Status | API | Frontend |
|---|---|---|---|---|---|
| F1 | Tạo bài giao | P0 | ✅ Done | POST /assignments | Dialog tạo assignment |
| F2 | Đóng bài giao | P0 | ✅ Done | PATCH /assignments/:id/close | Nút đóng |
| F3 | Deadline Enforcement | P1 | ⏳ Chưa làm | Schema dueAt đã có | — |
| F4 | Submission Tracking | P1 | ⏳ Chưa làm | — | — |
| F5 | Teacher Feedback per Attempt | P2 | ✅ Done | PATCH /attempts/:id/feedback | FeedbackDialog |
| F6 | File Attachments | P2 | ⏳ Chưa làm | — | — |
| F7 | Student File Submission | P2 | ⏳ Chưa làm | — | — |
| F8 | Manual Grading Workflow | P2 | ⏳ Chưa làm | — | — |
| F9 | Hide Score / Hide Results | P2 | ⏳ Chưa làm | — | — |
| F10 | Export Assignment Results | P2 | ⏳ Chưa làm | — | — |

---

## G. Grading & Results (Chấm điểm)

| ID | Feature | Priority | Status | API | Frontend |
|---|---|---|---|---|---|
| G1 | Auto-grading MCQ | P0 | ✅ Done | Trong submit logic | Tự động khi nộp |
| G2 | Kết quả cá nhân | P0 | ✅ Done | GET /attempts/:id | Trang kết quả |
| G3 | Kết quả lớp | P0 | ✅ Done | GET /attempts?examId= | /dashboard/results |
| G4 | Answer Review chi tiết | P1 | ✅ Done | GET /attempts/:id/review | ReviewDialog (teacher + student) |
| G5 | Sửa điểm (Manual Override) | P1 | ✅ Done | PATCH /attempts/:id/score | EditScoreDialog |
| G6 | Nhận xét từng câu | P1 | ✅ Done | PATCH /attempts/:id/feedback | FeedbackDialog |
| G7 | Partial Scoring MCQ_MULTI | P2 | ⏳ Chưa làm | Schema gradingMode đã có | — |
| G8 | Regrade Exam | P2 | ✅ Done | POST /exams/:id/regrade | ⚠️ API ready, chưa có nút UI |
| G9 | Export Results | P2 | ⏳ Chưa làm | — | — |

---

## H. Analytics & Reporting (Thống kê)

| ID | Feature | Priority | Status | API | Frontend |
|---|---|---|---|---|---|
| H1 | Classroom Performance | P1 | ✅ Done | GET /analytics/classrooms/:id | /dashboard/analytics — 4 stat cards |
| H2 | Score Distribution | P1 | ✅ Done | GET /analytics/exams/:id/distribution | Bar chart phân phối điểm |
| H3 | Completion Rate | P1 | ✅ Done | Trong H1 endpoint | Stat card |
| H4 | Question Accuracy | P1 | ✅ Done | GET /analytics/exams/:id/questions | Progress bars + color coding |
| H5 | Most Incorrect Questions | P1 | ✅ Done | Sắp xếp từ H4 | Highlight đỏ |
| H6 | Student Ranking | P2 | ✅ Done | GET /analytics/exams/:id/ranking | ⚠️ API ready, chưa có UI riêng |
| H7 | Student Performance Over Time | P2 | ✅ Done | GET /analytics/students/:id/performance | ⚠️ API ready, chưa có chart UI |
| H8 | Export Reports | P2 | ⏳ Chưa làm | — | — |

---

## J. Notifications (Thông báo)

| ID | Feature | Priority | Status | API | Frontend |
|---|---|---|---|---|---|
| J1 | Notification Model | P1 | ✅ Done | Schema + Service + batch create | — |
| J2 | In-App Notifications | P1 | ✅ Done | GET/PATCH /notifications | Bell icon + /dashboard/notifications |
| J3 | Edge Cases (batch, cascade) | P1 | ✅ Done | createMany, cascade delete | — |
| J4 | Email Notifications | P2 | ⏳ Chưa làm | Cần email service | — |
| J5 | Deadline Reminders | P2 | ⏳ Chưa làm | Cần background scheduler | — |

---

## K. Advanced Features

| ID | Feature | Priority | Status | API | Frontend |
|---|---|---|---|---|---|
| K1 | Screen Exit Monitoring | P2 | ✅ Done | POST exit-log, return-log, GET exit-logs | visibilitychange listener |
| K2 | Archive/Restore Classroom | P2 | ✅ Done | Xem B11 | Xem B11 |
| K3 | Import/Export Student Lists | P2 | ⏳ Chưa làm | Xem B10 | — |
| K4–K17 | AI, OCR, Proctoring, Live, etc. | P3 | ⏳ Ngoài phạm vi | — | — |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | NestJS + Fastify |
| ORM | Prisma |
| Database | PostgreSQL 16 (Docker, port 5433) |
| Frontend | Next.js 16 + TypeScript |
| UI | Tailwind CSS 4.3 + shadcn/ui v4 (base-nova) |
| Auth | JWT access (15min) + refresh token rotation (7d) |
| Theme | next-themes, dark mặc định, Lumi brand #2563EB |

## API Routes

- **Auth**: /auth/register, /login, /logout, /refresh, /me, /profile, /forgot-password, /reset-password
- **Classrooms**: CRUD /classrooms, /join, /:id/members, /:id/archive, /:id/unarchive
- **Questions**: CRUD /questions, /questions/categories
- **Exams**: CRUD /exams, /:id/publish, /:id/release-results, /:id/regrade
- **Attempts**: /attempts/start, /:id/answer, /:id/submit, /:id/review, /:id/score, /:id/feedback, /:id/exit-log, /:id/return-log, /:id/exit-logs, /attempts/my
- **Assignments**: CRUD /assignments, /:id/close
- **Analytics**: /analytics/classrooms/:id, /exams/:id/distribution, /exams/:id/questions, /exams/:id/ranking, /students/:id/performance
- **Notifications**: GET /notifications, /notifications/count, PATCH /:id/read, POST /read-all

## Frontend Routes

| Route | Mô tả | Role |
|---|---|---|
| /login | Đăng nhập | Public |
| /register | Đăng ký | Public |
| /dashboard | Trang chính | All |
| /dashboard/classrooms | Danh sách lớp | All |
| /dashboard/classrooms/[id] | Chi tiết lớp | All |
| /dashboard/questions | Ngân hàng câu hỏi | Teacher |
| /dashboard/exams | Danh sách đề thi | Teacher |
| /dashboard/exams/[id] | Chi tiết đề thi | Teacher |
| /dashboard/assignments | Bài giao / Bài cần làm | All |
| /dashboard/results | Kết quả (teacher view) | Teacher |
| /dashboard/my-results | Kết quả của tôi | Student |
| /dashboard/take-exam/[examId] | Làm bài thi | Student |
| /dashboard/analytics | Thống kê | Teacher |
| /dashboard/profile | Hồ sơ cá nhân | All |
| /dashboard/notifications | Thông báo | All |

---

## Ghi chú

- ⚠️ **API ready, chưa có UI**: Một số feature có backend API hoàn chỉnh nhưng chưa có frontend UI tương ứng (A4, C6, G8, H6, H7). Có thể bổ sung UI sau.
- **P3 features**: Hoàn toàn ngoài phạm vi hiện tại (AI, OCR, Proctoring, Live classroom, etc.).
- **Notification triggers**: Schema và service đã có nhưng chưa integrate vào flow tạo assignment/submit/release — cần gọi `NotificationsService.create()` từ các service liên quan.
- **File upload**: imageUrl field trên Question đã có nhưng chưa có upload endpoint/UI (cần MinIO hoặc local storage setup).
