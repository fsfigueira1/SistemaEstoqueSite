-- 0.3.1: meta de lucro sobre o custo (%)
ALTER TABLE "Settings" ADD COLUMN IF NOT EXISTS "profitTargetPercent" DOUBLE PRECISION NOT NULL DEFAULT 110;
