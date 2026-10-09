-- CreateTable
CREATE TABLE "NotificationLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventKey" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "subject" TEXT,
    "sentAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Settings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "startingBankroll" REAL NOT NULL DEFAULT 1000000,
    "currency" TEXT NOT NULL DEFAULT 'TZS',
    "taxRate" REAL NOT NULL DEFAULT 0.12,
    "emailEnabled" BOOLEAN NOT NULL DEFAULT true,
    "alertEmail" TEXT NOT NULL DEFAULT 'nathanielmwaipopo@gmail.com',
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Settings" ("currency", "id", "startingBankroll", "taxRate", "updatedAt") SELECT "currency", "id", "startingBankroll", "taxRate", "updatedAt" FROM "Settings";
DROP TABLE "Settings";
ALTER TABLE "new_Settings" RENAME TO "Settings";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "NotificationLog_sentAt_idx" ON "NotificationLog"("sentAt");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationLog_eventKey_stage_key" ON "NotificationLog"("eventKey", "stage");
