-- CreateTable
CREATE TABLE "RouteDataset" (
    "id" TEXT NOT NULL,
    "routeId" INTEGER NOT NULL,
    "key" TEXT NOT NULL,
    "valueJson" JSONB NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RouteDataset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RouteDataset_key_idx" ON "RouteDataset"("key");

-- CreateIndex
CREATE UNIQUE INDEX "RouteDataset_routeId_key_key" ON "RouteDataset"("routeId", "key");

-- AddForeignKey
ALTER TABLE "RouteDataset" ADD CONSTRAINT "RouteDataset_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "MockRoute"("id") ON DELETE CASCADE ON UPDATE CASCADE;

