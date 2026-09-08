import "dotenv/config";
/**
 * Copia todos os dados do dev.db (SQLite) para o banco em DATABASE_URL (Postgres/Supabase).
 *
 *   1. rode `npm run db:migrate` no Postgres (cria as tabelas)
 *   2. DATABASE_URL="postgres://..."  npm run db:from-sqlite
 *
 * Lê o SQLite direto com better-sqlite3 (o client Prisma já é Postgres-only).
 * Idempotente: createMany com skipDuplicates.
 */
import Database from "better-sqlite3";
import { PrismaClient } from "../src/generated/prisma/client.ts";
import { PrismaPg } from "@prisma/adapter-pg";

const SQLITE_PATH = process.env.SQLITE_PATH ?? "dev.db";
const PG_URL = process.env.DATABASE_URL;

if (!PG_URL || !/^postgres(ql)?:\/\//i.test(PG_URL)) {
  console.error("DATABASE_URL precisa apontar para o Postgres de destino.");
  process.exit(1);
}

const sqlite = new Database(SQLITE_PATH, { readonly: true });
const dst = new PrismaClient({ adapter: new PrismaPg({ connectionString: PG_URL }) });

// (tabela no SQLite, model no Prisma) — ordem respeita as foreign keys
const PLAN: [string, string][] = [
  ["User", "user"],
  ["Category", "category"],
  ["Supplier", "supplier"],
  ["Customer", "customer"],
  ["CashRegister", "cashRegister"],
  ["Settings", "settings"],
  ["CashSession", "cashSession"],
  ["Product", "product"],
  ["Sale", "sale"],
  ["CashMovement", "cashMovement"],
  ["SaleItem", "saleItem"],
  ["SalePayment", "salePayment"],
  ["StockMovement", "stockMovement"],
  ["PriceHistory", "priceHistory"],
  ["AuditLog", "auditLog"],
  ["PurchaseOrder", "purchaseOrder"],
  ["PurchaseOrderItem", "purchaseOrderItem"],
];

// campos que no SQLite são texto/número e no Postgres são Date / Json / Boolean
const DATE_FIELDS = new Set([
  "createdAt", "updatedAt", "openedAt", "closedAt", "changedAt", "refundedAt",
  "orderDate", "receivedDate", "expectedDate",
]);
const JSON_FIELDS = new Set(["metadata"]);
const BOOL_FIELDS = new Set(["isActive", "isFeatured", "receiptShowCompany"]);

function coerce(row: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    if (v === null || v === undefined) { out[k] = v; continue; }
    if (DATE_FIELDS.has(k)) out[k] = new Date(v as string | number);
    else if (JSON_FIELDS.has(k)) out[k] = typeof v === "string" ? JSON.parse(v) : v;
    else if (BOOL_FIELDS.has(k)) out[k] = v === 1 || v === true || v === "true";
    else out[k] = v;
  }
  return out;
}

async function main() {
  for (const [tbl, model] of PLAN) {
    let rows: Record<string, unknown>[];
    try {
      rows = sqlite.prepare(`SELECT * FROM "${tbl}"`).all() as Record<string, unknown>[];
    } catch {
      console.log(`- ${tbl}: (tabela não existe no SQLite)`);
      continue;
    }
    if (rows.length === 0) { console.log(`- ${tbl}: 0`); continue; }
    const data = rows.map(coerce);
    // @ts-expect-error índice dinâmico
    const res = await dst[model].createMany({ data, skipDuplicates: true });
    console.log(`+ ${tbl}: ${res.count}/${rows.length}`);
  }
  console.log("\nMigração de dados concluída.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { sqlite.close(); await dst.$disconnect(); });
