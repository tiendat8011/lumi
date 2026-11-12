# A. Authentication & User Management

## P0 — Done

### A1. Register / Login / Logout
- **API**: POST /auth/register, POST /auth/login, POST /auth/logout
- **Flow**: bcrypt hash → JWT access (15min) + refresh token rotation (7d)
- **Edge cases**:
  - Duplicate email → 409 Conflict
  - Weak password (<8 chars) → 400 validation
  - Expired access token → auto-refresh via interceptor
  - Expired refresh token → force re-login
  - Concurrent logout → idempotent (delete by hash, ignore if missing)

### A2. User Profile
- **API**: GET /auth/me
- **Returns**: id, email, displayName, role (passwordHash stripped)

### A3. Teacher / Student Roles
- **Enum**: TEACHER, STUDENT, ADMIN (ADMIN reserved, no dashboard)
- **Guards**: Global RolesGuard + @Roles() decorator
- **Edge cases**:
  - Student accessing teacher-only endpoint → 403
  - Role set at registration, immutable via API

---

## P1

### A4. Forgot / Reset Password
- **API**:
  - POST /auth/forgot-password `{email}` → generate reset token (crypto.randomBytes, 1hr TTL), log to console (no email service yet)
  - POST /auth/reset-password `{token, newPassword}` → validate token, hash new password, delete token
- **Schema**: `PasswordResetToken {id, userId, tokenHash, expiresAt, createdAt}`
- **Edge cases**:
  - Unknown email → 200 OK (don't reveal if email exists)
  - Expired token → 400 "Token expired"
  - Used token → delete after use, second use → 400 "Invalid token"
  - Rate limit: max 3 requests per email per hour (tracked in DB)

### A5. Edit Profile
- **API**: PATCH /auth/profile `{displayName?, currentPassword?, newPassword?}`
- **Rules**:
  - Changing password requires currentPassword validation
  - displayName: min 1, max 100 chars
  - Email change: not supported (P3)
- **Edge cases**:
  - Wrong currentPassword → 400
  - Same new password as current → 400
  - Empty payload → 200 no-op

---

## P2

### A6. Admin Role + Dashboard
- Deferred. ADMIN enum exists but no routes/UI.

### A7. Student Account Creation (by Teacher)
- **API**: POST /classrooms/:id/students `{email, displayName, password}`
- Teacher creates student accounts pre-populated with classroom membership.
- **Edge cases**:
  - Email already registered → link existing account to classroom
  - Bulk creation via CSV (see B.import)

### A8. Guest Access — P3, out of scope
