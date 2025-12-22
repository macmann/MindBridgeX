-- Add request schema/sample columns to MockRoute
ALTER TABLE "MockRoute"
ADD COLUMN "requestSchema" JSONB,
ADD COLUMN "requestSampleBody" TEXT NOT NULL DEFAULT '';
