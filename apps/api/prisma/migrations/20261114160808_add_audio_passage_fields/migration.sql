-- AlterTable
ALTER TABLE "exam_questions" ADD COLUMN     "audio_url_snapshot" TEXT,
ADD COLUMN     "passage_snapshot" TEXT;

-- AlterTable
ALTER TABLE "questions" ADD COLUMN     "audio_url" TEXT,
ADD COLUMN     "passage" TEXT;
