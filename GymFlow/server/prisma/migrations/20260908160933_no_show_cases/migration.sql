-- CreateEnum
CREATE TYPE "NoShowStatus" AS ENUM ('OPEN', 'RESOLVED', 'CANCELLED');

-- CreateTable
CREATE TABLE "NoShowCase" (
    "id" SERIAL NOT NULL,
    "gymId" INTEGER NOT NULL,
    "memberId" INTEGER NOT NULL,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastAttendance" TIMESTAMP(3),
    "inactiveDays" INTEGER NOT NULL,
    "status" "NoShowStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NoShowCase_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NoShowCase_gymId_idx" ON "NoShowCase"("gymId");

-- CreateIndex
CREATE INDEX "NoShowCase_memberId_idx" ON "NoShowCase"("memberId");

-- CreateIndex
CREATE INDEX "NoShowCase_status_idx" ON "NoShowCase"("status");

-- CreateIndex
CREATE INDEX "NoShowCase_detectedAt_idx" ON "NoShowCase"("detectedAt");

-- AddForeignKey
ALTER TABLE "NoShowCase" ADD CONSTRAINT "NoShowCase_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "Gym"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoShowCase" ADD CONSTRAINT "NoShowCase_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;
