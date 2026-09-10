-- Snapshot diário de vendas, gerado às 19:00 (horário de Brasília) por um
-- cron central na Vercel. `date` é o dia civil BRT (date puro) e serve de PK,
-- garantindo um relatório por dia (upsert idempotente).
--
-- Aplicar no Supabase: SQL Editor (o `prisma migrate deploy` trava no
-- Transaction pooler; ver RUNBOOK).

-- CreateTable
CREATE TABLE "DailyReport" (
    "date" DATE NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL,
    "totalAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "salesCount" INTEGER NOT NULL DEFAULT 0,
    "averageTicket" DECIMAL(65,30) NOT NULL DEFAULT 0,

    CONSTRAINT "DailyReport_pkey" PRIMARY KEY ("date")
);
