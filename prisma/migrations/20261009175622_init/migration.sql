-- CreateTable
CREATE TABLE "Settings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "startingBankroll" REAL NOT NULL DEFAULT 1000000,
    "currency" TEXT NOT NULL DEFAULT 'TZS',
    "taxRate" REAL NOT NULL DEFAULT 0.12,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "BetSlip" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" DATETIME NOT NULL,
    "strategy" TEXT NOT NULL,
    "stake" REAL NOT NULL,
    "totalOdds" REAL NOT NULL,
    "grossPayout" REAL NOT NULL,
    "taxPaid" REAL NOT NULL DEFAULT 0,
    "netProfit" REAL NOT NULL DEFAULT 0,
    "netReturn" REAL NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'Pending',
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "BetLeg" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "betSlipId" TEXT NOT NULL,
    "matchName" TEXT NOT NULL,
    "market" TEXT NOT NULL,
    "odds" REAL NOT NULL,
    CONSTRAINT "BetLeg_betSlipId_fkey" FOREIGN KEY ("betSlipId") REFERENCES "BetSlip" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
