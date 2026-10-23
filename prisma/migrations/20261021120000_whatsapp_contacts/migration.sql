-- Contatos e mensagens do WhatsApp (aplicado também em runtime por src/lib/schemaUpgrade.ts)
CREATE TABLE IF NOT EXISTS "Contact" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "name" TEXT,
    "source" TEXT NOT NULL DEFAULT 'whatsapp',
    "optInAt" TIMESTAMP(3),
    "optOutAt" TIMESTAMP(3),
    "optInAskedAt" TIMESTAMP(3),
    "botPausedUntil" TIMESTAMP(3),
    "customerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Contact_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "Contact_phone_key" ON "Contact"("phone");

CREATE TABLE IF NOT EXISTS "WhatsAppMessage" (
    "id" TEXT NOT NULL,
    "metaId" TEXT,
    "contactId" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "body" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'received',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WhatsAppMessage_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "WhatsAppMessage_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "WhatsAppMessage_metaId_key" ON "WhatsAppMessage"("metaId");

CREATE INDEX IF NOT EXISTS "WhatsAppMessage_contactId_createdAt_idx" ON "WhatsAppMessage"("contactId", "createdAt");

