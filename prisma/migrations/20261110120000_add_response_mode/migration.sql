-- CreateEnum
CREATE TYPE "ResponseMode" AS ENUM ('STATIC', 'TEMPLATE', 'DATASET_LOOKUP');

-- AlterTable
ALTER TABLE "MockRoute"
  ADD COLUMN "lookupParamName" TEXT,
  ADD COLUMN "notFoundBody" JSONB NOT NULL DEFAULT '{"error":"Not found"}',
  ADD COLUMN "notFoundStatus" INTEGER NOT NULL DEFAULT 404,
  ADD COLUMN "responseMode" "ResponseMode" NOT NULL DEFAULT 'STATIC';
