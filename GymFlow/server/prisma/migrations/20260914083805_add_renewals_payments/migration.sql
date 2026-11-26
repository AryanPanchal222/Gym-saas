-- CreateEnum
CREATE TYPE "RenewalOrderStatus" AS ENUM ('PENDING', 'PAID', 'FAILED', 'CANCELLED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED', 'REFUNDED');

-- CreateTable
CREATE TABLE "RenewalOrder" (
    "id" SERIAL NOT NULL,
    "gymId" INTEGER NOT NULL,
    "memberId" INTEGER NOT NULL,
    "membershipId" INTEGER NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "status" "RenewalOrderStatus" NOT NULL DEFAULT 'PENDING',
    "provider" TEXT,
    "providerOrderId" TEXT,
    "expiresAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RenewalOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" SERIAL NOT NULL,
    "gymId" INTEGER NOT NULL,
    "memberId" INTEGER NOT NULL,
    "renewalOrderId" INTEGER NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "provider" TEXT,
    "providerPaymentId" TEXT,
    "paidAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RenewalOrder_providerOrderId_key" ON "RenewalOrder"("providerOrderId");

-- CreateIndex
CREATE INDEX "RenewalOrder_gymId_idx" ON "RenewalOrder"("gymId");

-- CreateIndex
CREATE INDEX "RenewalOrder_memberId_idx" ON "RenewalOrder"("memberId");

-- CreateIndex
CREATE INDEX "RenewalOrder_membershipId_idx" ON "RenewalOrder"("membershipId");

-- CreateIndex
CREATE INDEX "RenewalOrder_status_idx" ON "RenewalOrder"("status");

-- CreateIndex
CREATE INDEX "RenewalOrder_expiresAt_idx" ON "RenewalOrder"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_providerPaymentId_key" ON "Payment"("providerPaymentId");

-- CreateIndex
CREATE INDEX "Payment_gymId_idx" ON "Payment"("gymId");

-- CreateIndex
CREATE INDEX "Payment_memberId_idx" ON "Payment"("memberId");

-- CreateIndex
CREATE INDEX "Payment_renewalOrderId_idx" ON "Payment"("renewalOrderId");

-- CreateIndex
CREATE INDEX "Payment_status_idx" ON "Payment"("status");

-- AddForeignKey
ALTER TABLE "RenewalOrder" ADD CONSTRAINT "RenewalOrder_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "Gym"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RenewalOrder" ADD CONSTRAINT "RenewalOrder_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RenewalOrder" ADD CONSTRAINT "RenewalOrder_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "Membership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "Gym"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_renewalOrderId_fkey" FOREIGN KEY ("renewalOrderId") REFERENCES "RenewalOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
