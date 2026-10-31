-- CreateEnum
CREATE TYPE "FollowUpOutcome" AS ENUM ('WILL_RETURN', 'INJURED', 'TRAVELLING', 'TIMING_ISSUE', 'UNHAPPY', 'NO_RESPONSE', 'CANCELLED');

-- CreateTable
CREATE TABLE "FollowUp" (
    "id" SERIAL NOT NULL,
    "gymId" INTEGER NOT NULL,
    "noShowCaseId" INTEGER NOT NULL,
    "memberId" INTEGER NOT NULL,
    "outcome" "FollowUpOutcome" NOT NULL,
    "notes" TEXT,
    "nextActionAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FollowUp_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FollowUp_gymId_idx" ON "FollowUp"("gymId");

-- CreateIndex
CREATE INDEX "FollowUp_noShowCaseId_idx" ON "FollowUp"("noShowCaseId");

-- CreateIndex
CREATE INDEX "FollowUp_memberId_idx" ON "FollowUp"("memberId");

-- CreateIndex
CREATE INDEX "FollowUp_nextActionAt_idx" ON "FollowUp"("nextActionAt");

-- AddForeignKey
ALTER TABLE "FollowUp" ADD CONSTRAINT "FollowUp_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "Gym"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowUp" ADD CONSTRAINT "FollowUp_noShowCaseId_fkey" FOREIGN KEY ("noShowCaseId") REFERENCES "NoShowCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowUp" ADD CONSTRAINT "FollowUp_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;
