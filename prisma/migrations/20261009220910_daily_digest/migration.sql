-- CreateTable
CREATE TABLE "DigestLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "digestDate" TEXT NOT NULL,
    "qualifyingCount" INTEGER NOT NULL DEFAULT 0,
    "sent" BOOLEAN NOT NULL DEFAULT false,
    "statusMessage" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "DigestLog_createdAt_idx" ON "DigestLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "DigestLog_digestDate_key" ON "DigestLog"("digestDate");
