/* eslint-disable @typescript-eslint/no-require-imports */
// Monta ./server-bundle: cópia auto-suficiente do servidor Next de produção
// (fora de .next/, sem ponto no caminho — o electron-builder não filtra
// pastas assim). É isso que vai empacotado no Electron.
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const standalone = path.join(root, ".next", "standalone");
// fora do OneDrive: artefatos grandes somem/deshidratam dentro dele
const out = process.env.LACOLARIA_BUNDLE_DIR || require("node:path").join(require("node:os").homedir(), "lacolaria-dist", "server-bundle");

if (!fs.existsSync(path.join(standalone, "server.js"))) {
  console.error("Rode `next build` antes (output: 'standalone').");
  process.exit(1);
}

fs.rmSync(out, { recursive: true, force: true });
fs.cpSync(standalone, out, { recursive: true, force: true, dereference: true });
fs.cpSync(path.join(root, ".next", "static"), path.join(out, ".next", "static"), {
  recursive: true,
  force: true,
});
fs.cpSync(path.join(root, "public"), path.join(out, "public"), { recursive: true, force: true });

for (const f of [".env", ".env.local", ".env.production"]) {
  const p = path.join(out, f);
  if (fs.existsSync(p)) fs.rmSync(p);
}

console.log("server-bundle pronto:", out);
