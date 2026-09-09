/* eslint-disable no-console */
// Publica o instalador Windows no GitHub Releases (auto-update).
// Lê GH_TOKEN do .env (que é gitignorado) para não precisar exportar a cada vez.
import "dotenv/config";
import { spawnSync } from "node:child_process";

if (!process.env.GH_TOKEN) {
  console.error(
    [
      "",
      "GH_TOKEN não encontrado.",
      "",
      "1. Crie um token em: github.com → foto → Settings → Developer settings",
      "   → Personal access tokens → Tokens (classic) → Generate new token (classic)",
      "   Escopo: marque apenas 'public_repo'. Expiração: 90 dias ou sem expiração.",
      "2. Cole no arquivo .env (na raiz do projeto), numa linha:",
      "   GH_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx",
      "3. Rode de novo: npm run electron:publish",
      "",
    ].join("\n"),
  );
  process.exit(1);
}

const result = spawnSync(
  "npx",
  ["electron-builder", "--win", "nsis", "--publish", "always"],
  { stdio: "inherit", shell: process.platform === "win32", env: process.env },
);

process.exit(result.status ?? 1);
