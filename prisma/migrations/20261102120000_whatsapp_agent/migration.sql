-- Agente de IA do WhatsApp e "chamar de volta" (aplicado também em runtime por src/lib/schemaUpgrade.ts)
ALTER TABLE "Settings" ADD COLUMN IF NOT EXISTS "waWinbackEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Settings" ADD COLUMN IF NOT EXISTS "waWinbackDays" INTEGER NOT NULL DEFAULT 60;
ALTER TABLE "Settings" ADD COLUMN IF NOT EXISTS "waWinbackPerDay" INTEGER NOT NULL DEFAULT 8;
CREATE TABLE IF NOT EXISTS "AgentEvent" (
  "id" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "name" TEXT NOT NULL DEFAULT '',
  "phone" TEXT NOT NULL DEFAULT '',
  "intent" TEXT NOT NULL DEFAULT 'other',
  "steps" JSONB NOT NULL DEFAULT '[]',
  "customerText" TEXT NOT NULL DEFAULT '',
  "reply" TEXT NOT NULL DEFAULT '',
  "reason" TEXT NOT NULL DEFAULT '',
  "quoteRequestId" TEXT,
  "total" DECIMAL(65,30) NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'pronta',
  "sentAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AgentEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "AgentEvent_createdAt_idx" ON "AgentEvent"("createdAt");
CREATE INDEX IF NOT EXISTS "AgentEvent_phone_idx" ON "AgentEvent"("phone");
CREATE INDEX IF NOT EXISTS "AgentEvent_kind_createdAt_idx" ON "AgentEvent"("kind", "createdAt");
