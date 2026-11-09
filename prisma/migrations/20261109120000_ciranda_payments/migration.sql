-- Comprovantes de Pix dos livros do Ciranda (venda da APM) recebidos no WhatsApp (aplicado também em runtime por src/lib/schemaUpgrade.ts)
CREATE TABLE IF NOT EXISTS "CirandaPayment" (
  "id" TEXT NOT NULL,
  "contactKey" TEXT NOT NULL,
  "contactName" TEXT NOT NULL DEFAULT '',
  "phone" TEXT NOT NULL DEFAULT '',
  "childName" TEXT NOT NULL DEFAULT '',
  "schoolGrade" TEXT NOT NULL DEFAULT '',
  "guardianName" TEXT NOT NULL DEFAULT '',
  "hasReceipt" BOOLEAN NOT NULL DEFAULT false,
  "receiptImage" TEXT NOT NULL DEFAULT '',
  "receiptInfo" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CirandaPayment_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "CirandaPayment_contactKey_createdAt_idx" ON "CirandaPayment"("contactKey", "createdAt");
CREATE INDEX IF NOT EXISTS "CirandaPayment_createdAt_idx" ON "CirandaPayment"("createdAt");
