-- AlterTable: make password_hash optional for OAuth users
ALTER TABLE "users" ALTER COLUMN "password_hash" DROP NOT NULL;

-- AlterTable: add Google OAuth fields
ALTER TABLE "users" ADD COLUMN "google_id" TEXT;
ALTER TABLE "users" ADD COLUMN "avatar_url" TEXT;

-- CreateIndex: unique constraint on google_id
CREATE UNIQUE INDEX "users_google_id_key" ON "users"("google_id");
