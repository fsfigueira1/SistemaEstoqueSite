-- Login com usuário e senha (dono e balcão) e avisos da assistente (aplicado também em runtime por src/lib/schemaUpgrade.ts)
ALTER TABLE "Settings" ADD COLUMN IF NOT EXISTS "authOwnerUser" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Settings" ADD COLUMN IF NOT EXISTS "authOwnerHash" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Settings" ADD COLUMN IF NOT EXISTS "authEmployeeUser" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Settings" ADD COLUMN IF NOT EXISTS "authEmployeeHash" TEXT NOT NULL DEFAULT '';
ALTER TABLE "AgentEvent" ADD COLUMN IF NOT EXISTS "seenAt" TIMESTAMP(3);
