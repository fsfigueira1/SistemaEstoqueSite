-- Orçamentos pedidos e horário da loja (aplicado também em runtime por src/lib/schemaUpgrade.ts)
ALTER TABLE "Settings" ADD COLUMN IF NOT EXISTS "storeHours" TEXT NOT NULL DEFAULT 'Segunda a sexta: 8h às 18h · Sábado: 8h às 13h';

CREATE TABLE IF NOT EXISTS "QuoteRequest" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "phone" TEXT,
    "source" TEXT NOT NULL DEFAULT 'whatsapp',
    "title" TEXT NOT NULL DEFAULT '',
    "items" JSONB NOT NULL,
    "toConfirm" JSONB NOT NULL DEFAULT '[]',
    "total" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'aberto',
    "message" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "QuoteRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "QuoteRequest_phone_idx" ON "QuoteRequest"("phone");

CREATE INDEX IF NOT EXISTS "QuoteRequest_createdAt_idx" ON "QuoteRequest"("createdAt");

CREATE INDEX IF NOT EXISTS "QuoteRequest_status_idx" ON "QuoteRequest"("status");

