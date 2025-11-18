-- CreateTable
CREATE TABLE "MockRoute" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "projectId" INTEGER NOT NULL,
    "name" TEXT,
    "description" TEXT,
    "method" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "matchHeaders" JSONB,
    "responseStatus" INTEGER NOT NULL DEFAULT 200,
    "responseHeaders" JSONB,
    "responseBody" TEXT NOT NULL DEFAULT '',
    "responseIsJson" BOOLEAN NOT NULL DEFAULT false,
    "responseDelayMs" INTEGER NOT NULL DEFAULT 0,
    "templateEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MockRoute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MockRouteVar" (
    "id" SERIAL NOT NULL,
    "routeId" INTEGER NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MockRouteVar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "McpServer" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "projectId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "baseUrl" TEXT,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "McpServer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "McpAuthConfig" (
    "id" SERIAL NOT NULL,
    "serverId" INTEGER NOT NULL,
    "authType" TEXT NOT NULL DEFAULT 'none',
    "apiKeyHeaderName" TEXT,
    "apiKeyHeaderValue" TEXT,
    "apiKeyQueryName" TEXT,
    "apiKeyQueryValue" TEXT,
    "bearerToken" TEXT,
    "basicUsername" TEXT,
    "basicPassword" TEXT,
    "extraHeaders" JSONB,

    CONSTRAINT "McpAuthConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "McpTool" (
    "id" SERIAL NOT NULL,
    "serverId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "inputSchema" JSONB,
    "httpMethod" TEXT NOT NULL DEFAULT 'GET',
    "baseUrl" TEXT,
    "pathTemplate" TEXT,
    "queryMapping" JSONB,
    "bodyMapping" JSONB,
    "headersMapping" JSONB,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "McpTool_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MockRoute_userId_projectId_method_path_key" ON "MockRoute"("userId", "projectId", "method", "path");

-- CreateIndex
CREATE UNIQUE INDEX "MockRouteVar_routeId_key_key" ON "MockRouteVar"("routeId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "McpServer_userId_projectId_slug_key" ON "McpServer"("userId", "projectId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "McpAuthConfig_serverId_key" ON "McpAuthConfig"("serverId");

-- CreateIndex
CREATE UNIQUE INDEX "McpTool_serverId_name_key" ON "McpTool"("serverId", "name");

-- AddForeignKey
ALTER TABLE "MockRoute" ADD CONSTRAINT "MockRoute_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MockRoute" ADD CONSTRAINT "MockRoute_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MockRouteVar" ADD CONSTRAINT "MockRouteVar_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "MockRoute"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "McpServer" ADD CONSTRAINT "McpServer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "McpServer" ADD CONSTRAINT "McpServer_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "McpAuthConfig" ADD CONSTRAINT "McpAuthConfig_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "McpServer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "McpTool" ADD CONSTRAINT "McpTool_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "McpServer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
