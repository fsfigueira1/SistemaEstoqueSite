-- 0.3.0: taxas da maquininha/Pix e backup automático.
-- Idempotente: o app também aplica isto sozinho ao abrir (src/lib/schemaUpgrade.ts).
ALTER TABLE "Settings" ADD COLUMN IF NOT EXISTS "feeDebitPercent" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Settings" ADD COLUMN IF NOT EXISTS "feeCreditPercent" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Settings" ADD COLUMN IF NOT EXISTS "feeCreditInstallmentPercent" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Settings" ADD COLUMN IF NOT EXISTS "feePixPercent" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Settings" ADD COLUMN IF NOT EXISTS "backupEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Settings" ADD COLUMN IF NOT EXISTS "backupKeep" INTEGER NOT NULL DEFAULT 30;
