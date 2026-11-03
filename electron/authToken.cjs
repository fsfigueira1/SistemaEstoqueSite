/* eslint-disable @typescript-eslint/no-require-imports */
// Mesma conta de src/lib/authToken.ts, no processo principal do aplicativo:
// o robô do WhatsApp se identifica para o servidor com um crachá assinado
// (perfil ROBOT), que só abre as rotas do robô. Testado em
// src/lib/authToken.test.ts (os dois lados têm que dar o mesmo resultado).
/* global require, module */
"use strict";

const crypto = require("crypto");

// Mesma regra de src/lib/authToken.ts: segredo forte ou endereço do banco com
// senha; sem nenhum dos dois, falha (nunca um segredo fixo que dá para adivinhar).
function dbPassword(url) {
  try {
    return decodeURIComponent(new URL(url || "").password);
  } catch {
    return "";
  }
}

function authSecret(env) {
  const s = String((env && env.AUTH_SECRET) || "").trim();
  if (s.length >= 32) return s;
  const url = (env && env.DATABASE_URL) || "";
  if (dbPassword(url).length >= 8) return crypto.createHash("sha256").update(`lacolaria-auth|${url}`).digest("hex");
  throw new Error("Segredo do login não configurado (AUTH_SECRET)");
}

function signToken(secret, role, expiresAt) {
  const body = `v1.${role}.${Math.floor(expiresAt)}`;
  const sig = crypto.createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${sig}`;
}

/** Segredo novo (o aplicativo guarda na configuração na primeira vez). */
const newSecret = () => crypto.randomBytes(32).toString("hex");

module.exports = { authSecret, signToken, newSecret };
