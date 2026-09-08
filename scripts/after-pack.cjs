/* eslint-disable @typescript-eslint/no-require-imports */
// electron-builder filtra node_modules em extraResources, então copiamos o
// server-bundle inteiro (com node_modules) para resources/next-server aqui.
const fs = require("node:fs");
const path = require("node:path");

exports.default = async function afterPack(context) {
  const root = context.packager.projectDir;
  const src = path.join(root, "server-bundle");
  const dst = path.join(context.appOutDir, "resources", "next-server");

  if (!fs.existsSync(path.join(src, "server.js"))) {
    throw new Error("server-bundle não encontrado — rode `node scripts/prepare-standalone.cjs`.");
  }

  fs.rmSync(dst, { recursive: true, force: true });
  fs.cpSync(src, dst, { recursive: true, force: true, dereference: true });

  const hasNM = fs.existsSync(path.join(dst, "node_modules", "next"));
  console.log(`[after-pack] next-server copiado -> ${dst} (node_modules/next: ${hasNM ? "ok" : "FALTA"})`);
  if (!hasNM) throw new Error("node_modules não foi para o pacote.");
};
