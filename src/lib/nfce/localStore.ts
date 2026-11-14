// Arquivos fiscais neste PC (só no servidor):
// - certificado A1 + senha (cifrada com o AUTH_SECRET deste PC) — nunca vai para o banco na nuvem;
// - XMLs autorizados/cancelados numa pasta por ano/mês (guardar por 5 anos).
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto"
import { lerCertificado, type CertificadoA1 } from "@/lib/nfce/certificate"

/** Pasta privada (certificado). O app instalado aponta para a pasta de dados do Electron. */
export function pastaPrivada(): string {
  return process.env.LACOLARIA_FISCAL_DIR || path.join(os.homedir(), ".lacolaria", "fiscal")
}

/** Pasta dos XMLs (Documentos\Lacolaria Notas Fiscais no app instalado). */
export function pastaXml(): string {
  return process.env.LACOLARIA_FISCAL_XML_DIR || path.join(os.homedir(), "Documents", "Lacolaria Notas Fiscais")
}

const PFX = () => path.join(pastaPrivada(), "certificado.pfx")
const META = () => path.join(pastaPrivada(), "certificado.json")

function chaveCifra(): Buffer {
  const secret = process.env.AUTH_SECRET || ""
  if (secret.length < 16) throw new Error("Este PC não tem AUTH_SECRET para proteger a senha do certificado")
  return scryptSync(secret, "lacolaria-nfce-cert", 32)
}

function cifrar(texto: string): string {
  const iv = randomBytes(12)
  const c = createCipheriv("aes-256-gcm", chaveCifra(), iv)
  const enc = Buffer.concat([c.update(texto, "utf8"), c.final()])
  return [iv, c.getAuthTag(), enc].map((b) => b.toString("base64")).join(".")
}

function decifrar(s: string): string {
  const [iv, tag, enc] = s.split(".").map((p) => Buffer.from(p, "base64"))
  const d = createDecipheriv("aes-256-gcm", chaveCifra(), iv)
  d.setAuthTag(tag)
  return Buffer.concat([d.update(enc), d.final()]).toString("utf8")
}

export interface InfoCertificado {
  titular: string
  cnpj: string
  validoAte: string
  vencido: boolean
}

/** Confere a senha e grava o certificado neste PC. */
export function salvarCertificado(pfx: Buffer, senha: string): InfoCertificado {
  const cert = lerCertificado(pfx, senha) // erro claro se a senha estiver errada
  fs.mkdirSync(pastaPrivada(), { recursive: true })
  fs.writeFileSync(PFX(), pfx, { mode: 0o600 })
  fs.writeFileSync(META(), JSON.stringify({ senha: cifrar(senha) }), { mode: 0o600 })
  cache = null
  return info(cert)
}

export function apagarCertificado(): void {
  for (const f of [PFX(), META()]) fs.rmSync(f, { force: true })
  cache = null
}

let cache: { mtime: number; cert: CertificadoA1 } | null = null

/** Certificado deste PC (ou null se ainda não foi enviado). */
export function carregarCertificado(): CertificadoA1 | null {
  let st: fs.Stats
  try {
    st = fs.statSync(PFX())
  } catch {
    return null
  }
  if (cache && cache.mtime === st.mtimeMs) return cache.cert
  const meta = JSON.parse(fs.readFileSync(META(), "utf8")) as { senha: string }
  const cert = lerCertificado(fs.readFileSync(PFX()), decifrar(meta.senha))
  cache = { mtime: st.mtimeMs, cert }
  return cert
}

export function info(cert: CertificadoA1): InfoCertificado {
  return {
    titular: cert.titular,
    cnpj: cert.cnpj,
    validoAte: cert.validoAte.toISOString(),
    vencido: cert.validoAte.getTime() < Date.now(),
  }
}

/** Grava o XML em <pasta>\AAAA\MM\<chave>-<tipo>.xml (mês da emissão, horário de Brasília). */
export function arquivarXml(chave: string, tipo: "nfce" | "canc", xml: string, quando: Date): string {
  const local = new Date(quando.getTime() - 3 * 3600_000)
  const dir = path.join(pastaXml(), String(local.getUTCFullYear()), String(local.getUTCMonth() + 1).padStart(2, "0"))
  fs.mkdirSync(dir, { recursive: true })
  const file = path.join(dir, `${chave}-${tipo}.xml`)
  fs.writeFileSync(file, xml, "utf8")
  return file
}
