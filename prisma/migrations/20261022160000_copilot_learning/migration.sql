-- Tom de voz e exemplos aprendidos do copiloto (aplicado também em runtime por src/lib/schemaUpgrade.ts)
ALTER TABLE "Settings" ADD COLUMN IF NOT EXISTS "copilotPersona" TEXT NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS "CopilotExample" (
    "id" TEXT NOT NULL,
    "customerText" TEXT NOT NULL,
    "aiReply" TEXT NOT NULL DEFAULT '',
    "finalReply" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CopilotExample_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "CopilotExample_createdAt_idx" ON "CopilotExample"("createdAt");

