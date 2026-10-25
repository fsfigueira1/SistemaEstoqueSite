/* eslint-disable no-console */
// Publica o instalador Windows no GitHub Releases (auto-update).
// O código fica num repositório privado; os instaladores vão para o
// repositório público fsfigueira1/lacolaria-atualizacoes (build.publish no
// package.json), que não tem código — os PCs da loja baixam de lá sem senha.
// Lê GH_TOKEN do .env (gitignorado). Cria e envia a tag vX.Y.Z no código
// antes de publicar, para saber de qual commit saiu cada versão.
import "dotenv/config";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

function run(cmd, args, opts = {}) {
  // nosemgrep: javascript.lang.security.audit.spawn-shell-true.spawn-shell-true
  // Script de release local: cmd/args são internos (git, versão do package.json), sem input externo.
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

// Rascunho da versão no repositório de atualizações ANTES de enviar: o
// electron-builder manda o instalador e o .blockmap em paralelo e, sem
// rascunho, os dois tentavam criar a versão ao mesmo tempo (na 0.4.0 um deles
// falhou e a versão ficou sem o instalador). Com o rascunho, os dois usam o
// mesmo — e os PCs da loja só atualizam quando a dona clicar em "Publish release".
const { owner, repo } = JSON.parse(readFileSync("package.json", "utf8")).build.publish[0];
const gh = (path, init = {}) =>
  fetch(`https://api.github.com/repos/${owner}/${repo}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${process.env.GH_TOKEN}`, Accept: "application/vnd.github+json", "Content-Type": "application/json" },
  });
const releases = await (await gh("/releases?per_page=30")).json();
const existing = Array.isArray(releases) ? releases.find((r) => r.tag_name === tag) : null;
let draftUrl = existing ? existing.html_url : null;
if (existing && !existing.draft) {
  console.error(`\nA versão ${tag} já está publicada em ${existing.html_url}.\nSuba a versão no package.json antes de publicar de novo.`);
  process.exit(1);
}
if (!existing) {
  const created = await gh("/releases", { method: "POST", body: JSON.stringify({ tag_name: tag, name: version, draft: true, target_commitish: "main" }) });
  if (!created.ok) {
    console.error(`\nNão consegui criar o rascunho da versão ${tag} no GitHub (${created.status}): ${await created.text()}`);
    process.exit(1);
  }
  draftUrl = (await created.json()).html_url;
  console.log(`rascunho ${tag} criado.`);
}

const result = run(
  "npx",
  ["electron-builder", "--win", "nsis", "--publish", "always"],
  { stdio: "inherit" },
);
if (result.status === 0) {
  console.log(
    [
      "",
      `Pronto: o instalador ${tag} subiu como RASCUNHO.`,
      `Abra ${draftUrl}, confira os 3 arquivos (Lacolaria-Setup.exe, .blockmap e latest.yml)`,
      'e clique em "Publish release" — só então os PCs da loja se atualizam.',
      "",
    ].join("\n"),
  );
}
process.exit(result.status ?? 1);
