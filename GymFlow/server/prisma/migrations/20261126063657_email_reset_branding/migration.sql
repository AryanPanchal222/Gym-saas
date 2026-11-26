-- AlterTable
ALTER TABLE "Gym" ADD COLUMN     "accentColor" TEXT DEFAULT '#111827',
ADD COLUMN     "primaryColor" TEXT DEFAULT '#6d63ff';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "resetExpiresAt" TIMESTAMP(3),
ADD COLUMN     "resetTokenHash" TEXT;
