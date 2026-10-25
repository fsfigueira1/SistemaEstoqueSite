-- Resposta automática do WhatsApp (aplicado também em runtime por src/lib/schemaUpgrade.ts)
ALTER TABLE "Settings" ADD COLUMN IF NOT EXISTS "waAutoEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Settings" ADD COLUMN IF NOT EXISTS "waAutoMaxPerHour" INTEGER NOT NULL DEFAULT 20;
ALTER TABLE "Settings" ADD COLUMN IF NOT EXISTS "waAutoWeekdays" TEXT NOT NULL DEFAULT '08:00-18:00';
ALTER TABLE "Settings" ADD COLUMN IF NOT EXISTS "waAutoSaturday" TEXT NOT NULL DEFAULT '08:00-13:00';
ALTER TABLE "Settings" ADD COLUMN IF NOT EXISTS "waAutoSunday" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Settings" ADD COLUMN IF NOT EXISTS "storeInfo" TEXT NOT NULL DEFAULT ('Pagamento: Pix, cartão de débito, cartão de crédito e dinheiro, na loja. Parcelamento no cartão: a loja confirma.' || chr(10) || 'Loja física: o cliente retira na loja. Não entregamos e não temos pagamento online.' || chr(10) || 'Orçamento vale pelo preço de agora, sujeito à disponibilidade na retirada.');
