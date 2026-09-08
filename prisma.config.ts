import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Vazio ainda? veja RUNBOOK.md — coloque a URL do Postgres (Supabase) no .env
    url: process.env.DATABASE_URL ?? "",
  },
});
