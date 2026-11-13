# P0b Handoff — Platform Services

## Files created

| File | Description |
|---|---|
| `apps/api/src/modules/storage/storage.module.ts` | StorageModule: exports StorageService, registers UploadsController |
| `apps/api/src/modules/storage/storage.service.ts` | Wraps MinIO: put, getStream, remove, isConfigured; bucket auto-create on boot; 503 when unconfigured |
| `apps/api/src/modules/storage/upload.util.ts` | `readUpload(req, opts)`: multipart file reader with size, extension, MIME and magic-byte checks |
| `apps/api/src/modules/storage/uploads.controller.ts` | `POST /uploads/images` (TEACHER), `GET /uploads/images/*` (@Public, cached) |
| `apps/api/src/modules/storage/storage.service.spec.ts` | Unit tests: isConfigured false, error wrapping |
| `apps/api/src/modules/mail/mail.module.ts` | MailModule: exports MailService |
| `apps/api/src/modules/mail/mail.service.ts` | Nodemailer SMTP; logs when SMTP_HOST unset; skips @lumi.local; never throws |
| `apps/api/src/modules/mail/mail.service.spec.ts` | Unit tests: log on no SMTP, skip @lumi.local |
| `apps/api/src/modules/notifications/reminders.service.ts` | Cron every 5 min; checks REMINDERS_ENABLED; sends 24h and 1h deadline reminders |
| `apps/api/src/modules/notifications/reminders.service.spec.ts` | Unit test: handleCron returns immediately when disabled |
| `apps/api/src/modules/users/student-accounts.service.ts` | `createStudents(tx, teacherId, entries, classroomId?)`: 500-student limit, @lumi.local generation, bcrypt 12 |
| `apps/api/src/modules/users/student-accounts.service.spec.ts` | Unit tests: limit enforcement, successful creation |
| `apps/api/src/modules/question-bank/question-validation.ts` | `validateQuestionInput(dto)`: option/correctAnswer rules for all question types |
| `apps/api/src/modules/question-bank/question-selection.service.ts` | `count(ownerId, criteria)`, `pickRandom(db, ownerId, criteria, count, excludeIds)` |
| `apps/api/prisma/create-admin.ts` | CLI: `npm run create-admin --workspace=apps/api -- --email <e> --password <p>` |

## Files changed

| File | Description |
|---|---|
| `apps/api/package.json` | Added dependencies: @fastify/multipart, minio, nodemailer, @nestjs/schedule, csv-parse, mammoth; devDependencies: @types/nodemailer; added `create-admin` script |
| `apps/api/src/config/app.config.ts` | Added all new env vars (MINIO_*, SMTP_*, APP_BASE_URL, REMINDERS_ENABLED) — all optional with defaults |
| `apps/api/src/app.module.ts` | Registered ScheduleModule.forRoot(), StorageModule, MailModule, UsersModule |
| `apps/api/src/common/configure-app.ts` | Made async; registered @fastify/multipart with 10MB limit |
| `apps/api/src/main.ts` | Await configureApp (now async) |
| `apps/api/src/modules/notifications/notification-events.service.ts` | Filled all stub methods with real logic: Vietnamese text, Prisma lookups, notify calls, try/catch |
| `apps/api/src/modules/notifications/notifications.service.ts` | Added `notify(userIds, data, db?)` method with dedupeKey and skipDuplicates |
| `apps/api/src/modules/notifications/notifications.module.ts` | Added RemindersService as provider |
| `apps/api/src/modules/users/users.module.ts` | Added StudentAccountsService as provider and export |
| `apps/api/src/modules/question-bank/question-bank.module.ts` | Added QuestionSelectionService as provider and export |
| `apps/api/src/modules/exams/exams.service.ts` | Replaced inline isPublishableQuestion with validateQuestionInput; added validateWindow; window validation on create (AVAILABILITY_IN_PAST) and update (merged with stored values, INVALID_AVAILABILITY_WINDOW) |
| `apps/api/src/modules/attempts/attempts.service.ts` | Added lazy expiry to getMyAttempts (sweep expired IN_PROGRESS) and getResult (submitIfExpired before returning) |
| `apps/api/src/common/csv/csv.util.ts` | Added parseCsv (csv-parse/sync) and fileDownload (StreamableFile with content type) |
| `docker-compose.yml` | Added minio service (ports 9000/9001, volume miniodata, healthcheck); added MINIO_* env on api service; api depends_on minio |
| `.env.example` | Added all new env vars with comments |
| `apps/api/test/.env.test` | Added REMINDERS_ENABLED=false |
| `apps/api/test/jest-e2e.json` | Added @nestjs/schedule to transform and transformIgnorePatterns (ESM compat) |
| `apps/api/test/support/app.ts` | Await configureApp (now async) |

## Deviations

1. **QuestionSelectionService uses in-memory shuffle** instead of `ORDER BY random()` because Prisma doesn't support raw ordering functions in typed queries. The behavior is identical (random selection), but the mechanism differs from the design. For the scale of this project (~100 concurrent users), this is equivalent.

2. **`isPublishableQuestion` kept as a local function** in `exams.service.ts` that delegates to `validateQuestionInput`, rather than being replaced entirely. This maintains the same interface (`SourceQuestion | null` → boolean) while using the shared validation logic underneath.

3. **`configureApp` is now async** because `@fastify/multipart` registration is async. This required updating both `main.ts` and `test/support/app.ts` to await it.

4. **e2e Jest config updated** to add `@nestjs/schedule` ESM transform support — same pattern as existing `@nestjs/jwt` and `@nestjs/passport`.

## Evidence

### Build
```
npm run build:api → success (no errors)
```

### Unit tests
```
npm run test:api → 9 suites, 120 tests passed, 0 failed
  New suites: storage.service.spec.ts (4 tests), mail.service.spec.ts (2 tests),
              reminders.service.spec.ts (1 test), student-accounts.service.spec.ts (2 tests)
```

### E2E tests
```
npm run test:e2e:api → 6 suites, 151 passed, 11 todo, 0 failed
```

### Lint
```
npm run lint (API only) → 11 pre-existing errors (all parser config issues with test/ files),
6 pre-existing warnings. No new issues from P0b code.
```

## Not tested

- Actual MinIO connectivity (no MinIO running in test env)
- Actual SMTP sending (no SMTP in test env)
- Reminders cron with real database (unit test only checks disabled flag)
- create-admin script (would need database, no test coverage)

## Known issues / TODOs for later packages

- The uploads controller `GET /uploads/images/*` uses Fastify's wildcard param; later packages that add download routes for assignments and submissions will follow the same pattern
- The `deadlineReminder` method in NotificationEvents writes notifications inside the caller's transaction as specified — the reminder service wraps this in its own transaction
- `StudentAccountsService.createStudents` creates users one by one (not with `createMany`) because each password must be hashed individually and each user needs its id for the classroom membership. For batches of 50 (the max per request), this is acceptable
