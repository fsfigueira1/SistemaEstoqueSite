-- Novidades (envios pelo celular) e escolha da IA/NVIDIA (aplicado também em runtime por src/lib/schemaUpgrade.ts)
ALTER TABLE "Settings" ADD COLUMN IF NOT EXISTS "aiProvider" TEXT NOT NULL DEFAULT 'nvidia';

ALTER TABLE "Settings" ADD COLUMN IF NOT EXISTS "nvidiaApiKey" TEXT NOT NULL DEFAULT '';

ALTER TABLE "Settings" ADD COLUMN IF NOT EXISTS "nvidiaModel" TEXT NOT NULL DEFAULT 'nvidia/nemotron-3.5-super-vl-120b-a12b';

CREATE TABLE IF NOT EXISTS "Broadcast" (
    "id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Broadcast_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "BroadcastRecipient" (
    "broadcastId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3),
    CONSTRAINT "BroadcastRecipient_pkey" PRIMARY KEY ("broadcastId","contactId"),
    CONSTRAINT "BroadcastRecipient_broadcastId_fkey" FOREIGN KEY ("broadcastId") REFERENCES "Broadcast"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BroadcastRecipient_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "BroadcastRecipient_contactId_idx" ON "BroadcastRecipient"("contactId");

