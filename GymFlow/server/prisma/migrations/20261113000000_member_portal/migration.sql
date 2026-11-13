ALTER TABLE "Member"
  ADD COLUMN "portalPasswordHash" TEXT,
  ADD COLUMN "portalInviteHash" TEXT,
  ADD COLUMN "portalInviteExpiresAt" TIMESTAMP(3);
