-- CreateTable
CREATE TABLE "QrSession" (
    "id" SERIAL NOT NULL,
    "gymId" INTEGER NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QrSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "QrSession_token_key" ON "QrSession"("token");

-- CreateIndex
CREATE INDEX "QrSession_gymId_idx" ON "QrSession"("gymId");

-- CreateIndex
CREATE INDEX "QrSession_expiresAt_idx" ON "QrSession"("expiresAt");

-- AddForeignKey
ALTER TABLE "QrSession" ADD CONSTRAINT "QrSession_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "Gym"("id") ON DELETE CASCADE ON UPDATE CASCADE;
