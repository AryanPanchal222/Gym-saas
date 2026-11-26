ALTER TABLE "Member" ADD COLUMN "faceDescriptor" JSONB;

UPDATE "Attendance" SET "method" = 'MANUAL' WHERE "method" = 'QR';
ALTER TABLE "Attendance" ALTER COLUMN "method" DROP DEFAULT;
ALTER TYPE "AttendanceMethod" RENAME TO "AttendanceMethod_old";
CREATE TYPE "AttendanceMethod" AS ENUM ('FACE', 'MANUAL', 'ASSISTED');
ALTER TABLE "Attendance" ALTER COLUMN "method" TYPE "AttendanceMethod" USING ("method"::text::"AttendanceMethod");
DROP TYPE "AttendanceMethod_old";
ALTER TABLE "Attendance" ALTER COLUMN "method" SET DEFAULT 'MANUAL';

DROP TABLE "QrSession";
