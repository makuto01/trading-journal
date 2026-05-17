-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Trade" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "externalId" TEXT,
    "symbol" TEXT NOT NULL,
    "side" TEXT NOT NULL,
    "entry" REAL NOT NULL,
    "stopLoss" REAL NOT NULL,
    "takeProfit" REAL NOT NULL,
    "lots" REAL NOT NULL,
    "time" DATETIME NOT NULL,
    "reason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "exitPrice" REAL,
    "pnl" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "score" INTEGER,
    "tier" TEXT,
    "scoreBreakdown" TEXT,
    "autoFilled" BOOLEAN NOT NULL DEFAULT false
);
INSERT INTO "new_Trade" ("createdAt", "entry", "exitPrice", "externalId", "id", "lots", "pnl", "reason", "side", "status", "stopLoss", "symbol", "takeProfit", "time", "updatedAt") SELECT "createdAt", "entry", "exitPrice", "externalId", "id", "lots", "pnl", "reason", "side", "status", "stopLoss", "symbol", "takeProfit", "time", "updatedAt" FROM "Trade";
DROP TABLE "Trade";
ALTER TABLE "new_Trade" RENAME TO "Trade";
CREATE UNIQUE INDEX "Trade_externalId_key" ON "Trade"("externalId");
CREATE INDEX "Trade_status_idx" ON "Trade"("status");
CREATE INDEX "Trade_symbol_idx" ON "Trade"("symbol");
CREATE INDEX "Trade_time_idx" ON "Trade"("time");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
