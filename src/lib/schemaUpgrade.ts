// Atualização automática do banco para as funções novas (relatório do dia,
// conferência do caixa e pesquisa de preço — Google Shopping grátis ou Claude).
//
// Por que existe: nas lojas, o schema é aplicado à mão no SQL Editor do
// Supabase (o `prisma migrate` trava no Transaction pooler — ver RUNBOOK.md).
// Se o app atualizar antes de alguém rodar o SQL, as telas quebrariam com
// "coluna não existe". Aqui cada PC garante, uma vez por execução, que as
// colunas/tabelas novas existem. Todos os comandos são idempotentes
// (IF NOT EXISTS), então rodar em 3 PCs ao mesmo tempo é seguro.
//
// Mantenha em sincronia com prisma/migrations/20260924120000_reports_ai/migration.sql.
import { prisma } from "@/lib/prisma"

export const SCHEMA_UPGRADE_STATEMENTS: string[] = [
  // --- Settings: perfil da loja, IA e assistente ---
  `ALTER TABLE "Settings" ADD COLUMN IF NOT EXISTS "storeProfile" TEXT NOT NULL DEFAULT 'Papelaria nova, bem localizada, com curadoria e toque gourmet: produtos selecionados, atendimento caprichado e embalagem bonita. O cliente aceita pagar um pouco acima da média, desde que o preço seja justificável.'`,
  `ALTER TABLE "Settings" ADD COLUMN IF NOT EXISTS "storeCity" TEXT NOT NULL DEFAULT ''`,
  `ALTER TABLE "Settings" ADD COLUMN IF NOT EXISTS "aiApiKey" TEXT NOT NULL DEFAULT ''`,
  `ALTER TABLE "Settings" ADD COLUMN IF NOT EXISTS "aiModel" TEXT NOT NULL DEFAULT 'claude-sonnet-5'`,
  `ALTER TABLE "Settings" ADD COLUMN IF NOT EXISTS "priceAlertPercent" DOUBLE PRECISION NOT NULL DEFAULT 10`,
  `ALTER TABLE "Settings" ADD COLUMN IF NOT EXISTS "reportReminderEnabled" BOOLEAN NOT NULL DEFAULT true`,
  `ALTER TABLE "Settings" ADD COLUMN IF NOT EXISTS "reportReminderTime" TEXT NOT NULL DEFAULT '18:00'`,
  `ALTER TABLE "Settings" ADD COLUMN IF NOT EXISTS "cashFloatDefault" DOUBLE PRECISION NOT NULL DEFAULT 0`,
  `ALTER TABLE "Settings" ADD COLUMN IF NOT EXISTS "priceProvider" TEXT NOT NULL DEFAULT 'shopping'`,
  `ALTER TABLE "Settings" ADD COLUMN IF NOT EXISTS "shoppingApiKey" TEXT NOT NULL DEFAULT ''`,
  `ALTER TABLE "Settings" ADD COLUMN IF NOT EXISTS "priceMarkupPercent" DOUBLE PRECISION NOT NULL DEFAULT 10`,

  // --- Fechamento do dia ---
  `CREATE TABLE IF NOT EXISTS "DailyClosing" (
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
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "DailyClosing_date_key" ON "DailyClosing"("date")`,

  // --- Pesquisas de preço da IA ---
  `CREATE TABLE IF NOT EXISTS "PriceCheck" (
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
  )`,
  `CREATE INDEX IF NOT EXISTS "PriceCheck_productId_idx" ON "PriceCheck"("productId")`,
  `CREATE INDEX IF NOT EXISTS "PriceCheck_barcode_idx" ON "PriceCheck"("barcode")`,
  `CREATE INDEX IF NOT EXISTS "PriceCheck_createdAt_idx" ON "PriceCheck"("createdAt")`,
  `ALTER TABLE "PriceCheck" ADD COLUMN IF NOT EXISTS "provider" TEXT`,
]

let upgrade: Promise<void> | null = null

async function run(): Promise<void> {
  for (const sql of SCHEMA_UPGRADE_STATEMENTS) {
    try {
      await prisma.$executeRawUnsafe(sql)
    } catch (err) {
      // Duas máquinas criando a mesma coluna ao mesmo tempo pode gerar
      // "already exists" mesmo com IF NOT EXISTS — nesse caso está tudo certo.
      const msg = err instanceof Error ? err.message : String(err)
      if (/already exists|duplicate/i.test(msg)) continue
      throw err
    }
  }
}

/**
 * Garante que as colunas/tabelas novas existem. Roda uma vez por processo;
 * se falhar (ex.: sem internet), tenta de novo na próxima chamada.
 */
export function ensureSchema(): Promise<void> {
  if (!upgrade) {
    upgrade = run().catch((err) => {
      upgrade = null
      throw err
    })
  }
  return upgrade
}
