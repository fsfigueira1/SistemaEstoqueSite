-- NFC-e (nota fiscal do consumidor) — aplicado também em runtime por src/lib/schemaUpgrade.ts
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "ncm" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "cest" TEXT;
ALTER TABLE "Settings" ADD COLUMN IF NOT EXISTS "nfceConfig" TEXT NOT NULL DEFAULT '{}';
ALTER TABLE "Settings" ADD COLUMN IF NOT EXISTS "nfceCsc" TEXT NOT NULL DEFAULT '';
CREATE TABLE IF NOT EXISTS "NfceEmission" (
  "id" TEXT NOT NULL,
  "saleId" TEXT,
  "ambiente" INTEGER NOT NULL,
  "serie" INTEGER NOT NULL,
  "numero" INTEGER NOT NULL,
  "chave" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "cStat" INTEGER,
  "motivo" TEXT NOT NULL DEFAULT '',
  "protocolo" TEXT NOT NULL DEFAULT '',
  "total" DECIMAL(65,30) NOT NULL DEFAULT 0,
  "consumidorDoc" TEXT NOT NULL DEFAULT '',
  "xml" TEXT NOT NULL DEFAULT '',
  "cancelXml" TEXT NOT NULL DEFAULT '',
  "cancelReason" TEXT NOT NULL DEFAULT '',
  "authorizedAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "NfceEmission_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "NfceEmission_chave_key" ON "NfceEmission"("chave");
CREATE INDEX IF NOT EXISTS "NfceEmission_saleId_idx" ON "NfceEmission"("saleId");
CREATE INDEX IF NOT EXISTS "NfceEmission_ambiente_serie_numero_idx" ON "NfceEmission"("ambiente", "serie", "numero");
CREATE INDEX IF NOT EXISTS "NfceEmission_createdAt_idx" ON "NfceEmission"("createdAt");
