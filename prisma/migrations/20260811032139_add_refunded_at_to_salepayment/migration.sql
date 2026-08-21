/*
  Warnings:

  - Added the required column `updatedAt` to the `SalePayment` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_SalePayment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "saleId" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "amount" DECIMAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "transactionId" TEXT,
    "processingFee" DECIMAL,
    "installmentCount" INTEGER,
    "changeAmount" DECIMAL,
    "notes" TEXT,
    "processedById" TEXT NOT NULL,
    "refundedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SalePayment_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SalePayment_processedById_fkey" FOREIGN KEY ("processedById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_SalePayment" ("amount", "changeAmount", "createdAt", "id", "installmentCount", "method", "notes", "processedById", "processingFee", "saleId", "status", "transactionId") SELECT "amount", "changeAmount", "createdAt", "id", "installmentCount", "method", "notes", "processedById", "processingFee", "saleId", "status", "transactionId" FROM "SalePayment";
DROP TABLE "SalePayment";
ALTER TABLE "new_SalePayment" RENAME TO "SalePayment";
CREATE INDEX "SalePayment_saleId_idx" ON "SalePayment"("saleId");
CREATE INDEX "SalePayment_method_idx" ON "SalePayment"("method");
CREATE INDEX "SalePayment_status_idx" ON "SalePayment"("status");
CREATE INDEX "SalePayment_processedById_idx" ON "SalePayment"("processedById");
CREATE INDEX "SalePayment_createdAt_idx" ON "SalePayment"("createdAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
