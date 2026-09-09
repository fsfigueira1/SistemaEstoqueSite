// Instância única do PrismaClient (Postgres — Supabase em produção).
// Construção preguiçosa: só conecta na primeira query, para o `next build`
// conseguir importar as rotas sem precisar de banco.
import { PrismaClient, Prisma } from "../generated/prisma/client.ts";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function create(): PrismaClient {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL não definida. Configure a connection string do Postgres (Supabase) no .env.",
    );
  }
  // pool bem pequeno: o Session pooler do Supabase (free) limita a ~15
  // conexões no total, e o próprio Supabase já usa uma parte. PDV é
  // sequencial (um operador), então max 2 por máquina basta.
  // 3 máquinas x 2 = 6, com folga. Ajuste por DB_POOL_MAX se precisar.
  const adapter = new PrismaPg({
    connectionString: url,
    max: Number(process.env.DB_POOL_MAX) || 2,
    idleTimeoutMillis: 15_000,
    connectionTimeoutMillis: 20_000,
  });
  const client = new PrismaClient({ adapter });
  if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = client;
  return client;
}

const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    const client = globalForPrisma.prisma ?? create();
    const value = Reflect.get(client as object, prop, receiver);
    return typeof value === "function" ? value.bind(client) : value;
  },
});

export { prisma, Prisma };
export * from "../generated/prisma/client.ts";
