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
// Mantenha em sincronia com prisma/migrations/20260924120000_reports_ai/migration.sql
// (e as seguintes, como 20261014120000_product_labels, 20261020120000_school_lists, 20261021120000_whatsapp_contacts e 20261022120000_novidades_ia).
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
  // --- 0.3.0: taxas da maquininha e backup ---
  `ALTER TABLE "Settings" ADD COLUMN IF NOT EXISTS "feeDebitPercent" DOUBLE PRECISION NOT NULL DEFAULT 0`,
  `ALTER TABLE "Settings" ADD COLUMN IF NOT EXISTS "feeCreditPercent" DOUBLE PRECISION NOT NULL DEFAULT 0`,
  `ALTER TABLE "Settings" ADD COLUMN IF NOT EXISTS "feeCreditInstallmentPercent" DOUBLE PRECISION NOT NULL DEFAULT 0`,
  `ALTER TABLE "Settings" ADD COLUMN IF NOT EXISTS "feePixPercent" DOUBLE PRECISION NOT NULL DEFAULT 0`,
  `ALTER TABLE "Settings" ADD COLUMN IF NOT EXISTS "backupEnabled" BOOLEAN NOT NULL DEFAULT true`,
  `ALTER TABLE "Settings" ADD COLUMN IF NOT EXISTS "backupKeep" INTEGER NOT NULL DEFAULT 30`,
  // --- 0.3.1: meta de lucro ---
  `ALTER TABLE "Settings" ADD COLUMN IF NOT EXISTS "profitTargetPercent" DOUBLE PRECISION NOT NULL DEFAULT 110`,

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

  // --- 0.3.6: etiquetas de gôndola e promoção ---
  `CREATE TABLE IF NOT EXISTS "ProductLabel" (
    "productId" TEXT NOT NULL,
    "compareAtPrice" DECIMAL(65,30),
    "promoUntil" TIMESTAMP(3),
    "labelPrice" DECIMAL(65,30),
    "labelCompareAt" DECIMAL(65,30),
    "labelPrintedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProductLabel_pkey" PRIMARY KEY ("productId"),
    CONSTRAINT "ProductLabel_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,

  // --- 0.4.0: listas escolares salvas ---
  `CREATE TABLE IF NOT EXISTS "School" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "School_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "School_slug_key" ON "School"("slug")`,
  `CREATE TABLE IF NOT EXISTS "SchoolList" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "grade" TEXT NOT NULL,
    "schoolYear" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "sourceText" TEXT NOT NULL DEFAULT '',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SchoolList_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "SchoolList_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "SchoolList_code_key" ON "SchoolList"("code")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "SchoolList_schoolId_grade_schoolYear_key" ON "SchoolList"("schoolId", "grade", "schoolYear")`,
  `CREATE TABLE IF NOT EXISTS "SchoolListItem" (
    "id" TEXT NOT NULL,
    "listId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "raw" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "productId" TEXT,
    CONSTRAINT "SchoolListItem_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "SchoolListItem_listId_fkey" FOREIGN KEY ("listId") REFERENCES "SchoolList"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SchoolListItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE
  )`,
  `CREATE INDEX IF NOT EXISTS "SchoolListItem_listId_idx" ON "SchoolListItem"("listId")`,
  `CREATE INDEX IF NOT EXISTS "SchoolListItem_productId_idx" ON "SchoolListItem"("productId")`,

  // --- 0.4.0: contatos do WhatsApp ---
  `CREATE TABLE IF NOT EXISTS "Contact" (
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
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "Contact_phone_key" ON "Contact"("phone")`,
  `CREATE TABLE IF NOT EXISTS "WhatsAppMessage" (
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
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "WhatsAppMessage_metaId_key" ON "WhatsAppMessage"("metaId")`,
  `CREATE INDEX IF NOT EXISTS "WhatsAppMessage_contactId_createdAt_idx" ON "WhatsAppMessage"("contactId", "createdAt")`,

  // --- 0.4.0: novidades e IA da NVIDIA ---
  `ALTER TABLE "Settings" ADD COLUMN IF NOT EXISTS "aiProvider" TEXT NOT NULL DEFAULT 'nvidia'`,
  `ALTER TABLE "Settings" ADD COLUMN IF NOT EXISTS "nvidiaApiKey" TEXT NOT NULL DEFAULT ''`,
  `ALTER TABLE "Settings" ADD COLUMN IF NOT EXISTS "nvidiaModel" TEXT NOT NULL DEFAULT 'nvidia/nemotron-3.5-super-vl-120b-a12b'`,
  `CREATE TABLE IF NOT EXISTS "Broadcast" (
    "id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Broadcast_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE TABLE IF NOT EXISTS "BroadcastRecipient" (
    "broadcastId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3),
    CONSTRAINT "BroadcastRecipient_pkey" PRIMARY KEY ("broadcastId","contactId"),
    CONSTRAINT "BroadcastRecipient_broadcastId_fkey" FOREIGN KEY ("broadcastId") REFERENCES "Broadcast"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BroadcastRecipient_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE INDEX IF NOT EXISTS "BroadcastRecipient_contactId_idx" ON "BroadcastRecipient"("contactId")`,
]

let upgrade: Promise<void> | null = null

// O que já existe no banco (uma consulta só). Com isso o app não roda
// ALTER TABLE à toa a cada abertura — o ALTER trava a tabela, e com 3 PCs
// abrindo + backup rodando isso podia deixar as telas esperando.
async function existing(): Promise<{ cols: Set<string>; rels: Set<string> }> {
  const cols = await prisma.$queryRawUnsafe<Array<{ t: string; c: string }>>(
    `SELECT table_name AS t, column_name AS c FROM information_schema.columns WHERE table_schema = current_schema()`,
  )
  const rels = await prisma.$queryRawUnsafe<Array<{ n: string }>>(
    `SELECT c.relname AS n FROM pg_class c JOIN pg_namespace ns ON ns.oid = c.relnamespace WHERE ns.nspname = current_schema()`,
  )
  return { cols: new Set(cols.map((r) => `${r.t}.${r.c}`)), rels: new Set(rels.map((r) => r.n)) }
}

export function isAlreadyApplied(sql: string, have: { cols: Set<string>; rels: Set<string> }): boolean {
  const col = sql.match(/ALTER TABLE "(\w+)" ADD COLUMN IF NOT EXISTS "(\w+)"/i)
  if (col) return have.cols.has(`${col[1]}.${col[2]}`)
  const rel = sql.match(/CREATE (?:UNIQUE )?(?:TABLE|INDEX) IF NOT EXISTS "(\w+)"/i)
  if (rel) return have.rels.has(rel[1])
  return false
}

async function run(): Promise<void> {
  const have = await existing()
  for (const sql of SCHEMA_UPGRADE_STATEMENTS) {
    if (isAlreadyApplied(sql, have)) continue
    try {
      // não fica esperando para sempre por uma trava de outro PC
      await prisma.$transaction([
        prisma.$executeRawUnsafe(`SET LOCAL lock_timeout = '10s'`),
        prisma.$executeRawUnsafe(sql),
      ])
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
