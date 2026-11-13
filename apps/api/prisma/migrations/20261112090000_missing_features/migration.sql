-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'DEADLINE_REMINDER';

-- AlterTable
ALTER TABLE "answers" ADD COLUMN     "earned_points" DECIMAL(10,4),
ADD COLUMN     "manually_graded" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "assignments" ADD COLUMN     "reminder_intervals" JSONB DEFAULT '["24h","1h"]';

-- AlterTable
ALTER TABLE "exam_questions" ADD COLUMN     "correct_answer_snapshot" TEXT,
ADD COLUMN     "explanation_snapshot" TEXT,
ADD COLUMN     "image_url_snapshot" TEXT,
ADD COLUMN     "type_snapshot" TEXT;

-- AlterTable
ALTER TABLE "exams" ADD COLUMN     "allow_file_submission" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "notifications" ADD COLUMN     "dedupe_key" TEXT;

-- AlterTable
ALTER TABLE "question_groups" ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "created_by_teacher_id" UUID,
ADD COLUMN     "email_notifications_enabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "is_active" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "assignment_targets" (
    "id" UUID NOT NULL,
    "assignment_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,

    CONSTRAINT "assignment_targets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assignment_attachments" (
    "id" UUID NOT NULL,
    "assignment_id" UUID NOT NULL,
    "filename" TEXT NOT NULL,
    "storage_key" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "mime_type" TEXT NOT NULL,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assignment_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "submission_files" (
    "id" UUID NOT NULL,
    "attempt_id" UUID NOT NULL,
    "storage_key" TEXT NOT NULL,
    "original_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "submission_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deadline_reminders" (
    "id" UUID NOT NULL,
    "assignment_id" UUID NOT NULL,
    "interval" TEXT NOT NULL,
    "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recipient_count" INTEGER NOT NULL,

    CONSTRAINT "deadline_reminders_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "assignment_targets_student_id_idx" ON "assignment_targets"("student_id");

-- CreateIndex
CREATE UNIQUE INDEX "assignment_targets_assignment_id_student_id_key" ON "assignment_targets"("assignment_id", "student_id");

-- CreateIndex
CREATE UNIQUE INDEX "assignment_attachments_storage_key_key" ON "assignment_attachments"("storage_key");

-- CreateIndex
CREATE INDEX "assignment_attachments_assignment_id_idx" ON "assignment_attachments"("assignment_id");

-- CreateIndex
CREATE UNIQUE INDEX "submission_files_storage_key_key" ON "submission_files"("storage_key");

-- CreateIndex
CREATE UNIQUE INDEX "submission_files_attempt_id_original_name_key" ON "submission_files"("attempt_id", "original_name");

-- CreateIndex
CREATE UNIQUE INDEX "deadline_reminders_assignment_id_interval_key" ON "deadline_reminders"("assignment_id", "interval");

-- CreateIndex
CREATE INDEX "announcements_classroom_id_created_at_idx" ON "announcements"("classroom_id", "created_at");

-- CreateIndex
CREATE INDEX "assignments_classroom_id_idx" ON "assignments"("classroom_id");

-- CreateIndex
CREATE INDEX "exam_attempts_assignment_id_idx" ON "exam_attempts"("assignment_id");

-- CreateIndex
CREATE INDEX "notifications_user_id_created_at_idx" ON "notifications"("user_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "notifications_user_id_dedupe_key_key" ON "notifications"("user_id", "dedupe_key");

-- CreateIndex
CREATE INDEX "question_groups_owner_id_idx" ON "question_groups"("owner_id");

-- CreateIndex
CREATE INDEX "questions_owner_id_idx" ON "questions"("owner_id");

-- CreateIndex
CREATE INDEX "users_created_by_teacher_id_idx" ON "users"("created_by_teacher_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_created_by_teacher_id_fkey" FOREIGN KEY ("created_by_teacher_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_groups" ADD CONSTRAINT "question_groups_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignment_targets" ADD CONSTRAINT "assignment_targets_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "assignments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignment_targets" ADD CONSTRAINT "assignment_targets_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignment_attachments" ADD CONSTRAINT "assignment_attachments_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "assignments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submission_files" ADD CONSTRAINT "submission_files_attempt_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "exam_attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deadline_reminders" ADD CONSTRAINT "deadline_reminders_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "assignments"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------
-- Hand-written (design.md 2.3). Prisma cannot express a partial index.
-- ---------------------------------------------------------------------------

-- One IN_PROGRESS attempt per student and exam (E1-OQ-01 option B).
CREATE UNIQUE INDEX "exam_attempts_one_in_progress"
  ON "exam_attempts" ("exam_id", "student_id")
  WHERE "status" = 'IN_PROGRESS';

-- Backfill snapshots for exams published before this migration.
UPDATE "exam_questions" eq
SET "type_snapshot"           = q."type",
    "correct_answer_snapshot" = q."correct_answer",
    "image_url_snapshot"      = q."image_url",
    "explanation_snapshot"    = q."explanation"
FROM "questions" q, "exams" e
WHERE q."id" = eq."source_question_id"
  AND e."id" = eq."exam_id"
  AND e."status" <> 'DRAFT'
  AND eq."type_snapshot" IS NULL;

-- Published questions whose source was deleted: infer the type from the options.
UPDATE "exam_questions" eq
SET "type_snapshot" = CASE
      WHEN (SELECT count(*) FROM jsonb_array_elements(eq."options_snapshot") o
            WHERE (o->>'isCorrect')::boolean) > 1 THEN 'MCQ_MULTI'
      ELSE 'MCQ' END
FROM "exams" e
WHERE e."id" = eq."exam_id"
  AND e."status" <> 'DRAFT'
  AND eq."type_snapshot" IS NULL
  AND jsonb_typeof(eq."options_snapshot") = 'array';
