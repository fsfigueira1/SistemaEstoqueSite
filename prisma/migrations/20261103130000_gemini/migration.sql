-- Google Gemini como IA (escolhida ou reserva da NVIDIA) (aplicado também em runtime por src/lib/schemaUpgrade.ts)
ALTER TABLE "Settings" ADD COLUMN IF NOT EXISTS "geminiApiKey" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Settings" ADD COLUMN IF NOT EXISTS "geminiModel" TEXT NOT NULL DEFAULT 'gemini-3.8-flash';
