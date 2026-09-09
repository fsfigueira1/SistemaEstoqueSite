/* eslint-disable no-console */
// Publica o instalador Windows no GitHub Releases (auto-update).
// Lê GH_TOKEN do .env (gitignorado). Cria e envia a tag vX.Y.Z antes de
// publicar — sem a tag no git, a API do GitHub recusa o release (422).
import "dotenv/config";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

function run(cmd, args, opts = {}) {
  return spawnSync(cmd, args, { encoding: "utf8", shell: process.platform === "win32", ...opts });
}

if (!process.env.GH_TOKEN) {
  console.error(
    [
      "",
      "GH_TOKEN não encontrado.",
      "1. Crie um token (classic) em github.com com escopo 'public_repo'.",
      "2. Coloque no .env:  GH_TOKEN=ghp_xxxxxxxx",
      "3. Rode de novo: npm run electron:publish",
      "",
    ].join("\n"),
  );
  process.exit(1);
}

const version = JSON.parse(readFileSync("package.json", "utf8")).version;
const tag = `v${version}`;

// A tag já existe no remoto?
const remote = run("git", ["ls-remote", "--tags", "origin", tag]);
if (remote.stdout && remote.stdout.includes(`refs/tags/${tag}`)) {
  console.log(`tag ${tag} já está no GitHub — seguindo pro publish.`);
} else {
  console.log(`criando e enviando a tag ${tag}...`);
  run("git", ["tag", tag]); // ok falhar se já existir local
  const push = run("git", ["push", "origin", tag]);
  if (push.status !== 0) {
    console.error(push.stderr || push.stdout);
    console.error(`\nNão consegui enviar a tag ${tag}. Faça manual:\n  git push origin ${tag}\ndepois rode de novo.`);
    process.exit(1);
  }
}

const result = run(
  "npx",
  ["electron-builder", "--win", "nsis", "--publish", "always"],
  { stdio: "inherit" },
);
process.exit(result.status ?? 1);
