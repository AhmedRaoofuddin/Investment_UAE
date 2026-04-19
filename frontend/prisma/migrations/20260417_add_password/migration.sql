-- Make tenantId nullable (signup creates user before tenant in the same transaction)
ALTER TABLE "User" ALTER COLUMN "tenantId" DROP NOT NULL;

-- Add passwordHash column for credentials login
ALTER TABLE "User" ADD COLUMN "passwordHash" TEXT;
