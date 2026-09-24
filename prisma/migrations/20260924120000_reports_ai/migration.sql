-- Relatório do dia, conferência do caixa e pesquisa de preço (Google Shopping grátis ou Claude).
-- Idempotente: o app também aplica isto sozinho ao abrir (src/lib/schemaUpgrade.ts).
-- Pode rodar no SQL Editor do Supabase quantas vezes quiser.

ALTER TABLE "Settings" ADD COLUMN IF NOT EXISTS "storeProfile" TEXT NOT NULL DEFAULT 'Papelaria nova, bem localizada, com curadoria e toque gourmet: produtos selecionados, atendimento caprichado e embalagem bonita. O cliente aceita pagar um pouco acima da média, desde que o preço seja justificável.';

ALTER TABLE "Settings" ADD COLUMN IF NOT EXISTS "storeCity" TEXT NOT NULL DEFAULT '';

ALTER TABLE "Settings" ADD COLUMN IF NOT EXISTS "aiApiKey" TEXT NOT NULL DEFAULT '';

ALTER TABLE "Settings" ADD COLUMN IF NOT EXISTS "aiModel" TEXT NOT NULL DEFAULT 'claude-sonnet-5';

ALTER TABLE "Settings" ADD COLUMN IF NOT EXISTS "priceAlertPercent" DOUBLE PRECISION NOT NULL DEFAULT 10;

ALTER TABLE "Settings" ADD COLUMN IF NOT EXISTS "reportReminderEnabled" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "Settings" ADD COLUMN IF NOT EXISTS "reportReminderTime" TEXT NOT NULL DEFAULT '18:00';

ALTER TABLE "Settings" ADD COLUMN IF NOT EXISTS "cashFloatDefault" DOUBLE PRECISION NOT NULL DEFAULT 0;

ALTER TABLE "Settings" ADD COLUMN IF NOT EXISTS "priceProvider" TEXT NOT NULL DEFAULT 'shopping';

ALTER TABLE "Settings" ADD COLUMN IF NOT EXISTS "shoppingApiKey" TEXT NOT NULL DEFAULT '';

ALTER TABLE "Settings" ADD COLUMN IF NOT EXISTS "priceMarkupPercent" DOUBLE PRECISION NOT NULL DEFAULT 10;

CREATE TABLE IF NOT EXISTS "DailyClosing" (
  "id" TEXT NOT NULL,
  "date" TEXT NOT NULL,
  "cashFloat" DECIMAL(65,30) NOT NULL DEFAULT 0,
  "withdrawals" DECIMAL(65,30) NOT NULL DEFAULT 0,
  "expectedCash" DECIMAL(65,30) NOT NULL DEFAULT 0,
  "expectedCard" DECIMAL(65,30) NOT NULL DEFAULT 0,
  "expectedPix" DECIMAL(65,30) NOT NULL DEFAULT 0,
  "countedCash" DECIMAL(65,30),
  "countedCard" DECIMAL(65,30),
  "countedPix" DECIMAL(65,30),
  "difference" DECIMAL(65,30) NOT NULL DEFAULT 0,
  "notes" TEXT,
  "closedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DailyClosing_pkey" PRIMARY KEY ("id")
  );

CREATE UNIQUE INDEX IF NOT EXISTS "DailyClosing_date_key" ON "DailyClosing"("date");

CREATE TABLE IF NOT EXISTS "PriceCheck" (
  "id" TEXT NOT NULL,
  "productId" TEXT,
  "barcode" TEXT,
  "query" TEXT NOT NULL,
  "productName" TEXT,
  "brand" TEXT,
  "currentPrice" DECIMAL(65,30),
  "costPrice" DECIMAL(65,30),
  "suggestedPrice" DECIMAL(65,30),
  "rangeMin" DECIMAL(65,30),
  "rangeMax" DECIMAL(65,30),
  "marketMin" DECIMAL(65,30),
  "marketMedian" DECIMAL(65,30),
  "marketMax" DECIMAL(65,30),
  "direction" TEXT,
  "confidence" TEXT,
  "sources" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PriceCheck_pkey" PRIMARY KEY ("id")
  );

CREATE INDEX IF NOT EXISTS "PriceCheck_productId_idx" ON "PriceCheck"("productId");

CREATE INDEX IF NOT EXISTS "PriceCheck_barcode_idx" ON "PriceCheck"("barcode");

CREATE INDEX IF NOT EXISTS "PriceCheck_createdAt_idx" ON "PriceCheck"("createdAt");

ALTER TABLE "PriceCheck" ADD COLUMN IF NOT EXISTS "provider" TEXT;
