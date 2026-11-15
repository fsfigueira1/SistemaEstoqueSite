// Registro das NFC-e no banco: numeração com trava, gravação do protocolo
// e do XML autorizado (banco + pasta por ano/mês neste PC).
import { prisma } from "@/lib/prisma"
import { autorizada, denegada, montarNfeProc, type lerProtocolo } from "@/lib/nfce/sefaz"
import { arquivarXml, carregarCertificado } from "@/lib/nfce/localStore"
import type { NfceConfig } from "@/lib/nfce/config"
import type { CertificadoA1 } from "@/lib/nfce/certificate"

export type NfceStatus = "PENDING" | "AUTHORIZED" | "REJECTED" | "DENIED" | "CANCELLED"

export interface NfceResultado {
  id: string
  status: NfceStatus
  numero: number
  serie: number
  chave: string
  cStat: number | null
  motivo: string
  protocolo: string
  ambiente: number
  /** Caminho do XML salvo neste PC (quando autorizada). */
  arquivo?: string
}

/** Erro de negócio: a mensagem vai para a tela como está. */
export class NfceErro extends Error {}

/** Rejeição em que o número já ficou usado na SEFAZ (não pode repetir). */
const NUMERO_USADO_CSTAT = [539]

type Linha = Omit<NfceResultado, "status" | "arquivo"> & { status: string }

export const resultado = (r: Linha, arquivo?: string): NfceResultado => ({
  id: r.id,
  status: r.status as NfceStatus,
  numero: r.numero,
  serie: r.serie,
  chave: r.chave,
  cStat: r.cStat,
  motivo: r.motivo,
  protocolo: r.protocolo,
  ambiente: r.ambiente,
  arquivo,
})

export function exigirCertificado(cfg: NfceConfig): CertificadoA1 {
  let cert: CertificadoA1 | null
  try {
    cert = carregarCertificado()
  } catch (e) {
    throw new NfceErro(`Não consegui abrir o certificado deste computador: ${e instanceof Error ? e.message : e}`)
  }
  if (!cert) throw new NfceErro("Este computador ainda não tem o certificado digital A1 (Configurações → Nota fiscal)")
  if (cert.validoAte.getTime() < Date.now()) throw new NfceErro("O certificado digital está vencido — renove com a certificadora")
  if (cert.cnpj && cert.cnpj !== cfg.emitente.cnpj) {
    throw new NfceErro(`O certificado é do CNPJ ${cert.cnpj}, diferente do CNPJ da empresa na configuração`)
  }
  return cert
}

/**
 * Pega o próximo número livre (por ambiente e série) e já grava a nota como
 * PENDING. A trava (advisory lock) impede dois PCs de pegarem o mesmo número.
 * Número de nota rejeitada volta a ficar livre (a SEFAZ não o considera usado).
 */
export async function reservarNumero(
  cfg: NfceConfig,
  montar: (numero: number) => { chave: string; xml: string; total: number },
  saleId: string,
  consumidorDoc: string,
) {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(hashtext($1))`, `nfce:${cfg.ambiente}:${cfg.serie}`)
    const rows = await tx.$queryRawUnsafe<Array<{ m: number | null }>>(
      `SELECT MAX("numero") AS m FROM "NfceEmission" WHERE "ambiente" = $1 AND "serie" = $2 AND ("status" <> 'REJECTED' OR "cStat" = ANY($3::int[]))`,
      cfg.ambiente,
      cfg.serie,
      NUMERO_USADO_CSTAT,
    )
    const numero = Math.max(Number(rows[0]?.m ?? 0) + 1, cfg.numeroInicial)
    const m = montar(numero)
    return tx.nfceEmission.create({
      data: {
        saleId,
        ambiente: cfg.ambiente,
        serie: cfg.serie,
        numero,
        chave: m.chave,
        status: "PENDING",
        total: m.total,
        consumidorDoc,
        xml: m.xml,
      },
    })
  })
}

/** Grava o resultado de um protocolo de autorização na linha da nota. */
export async function aplicarProtocolo(
  id: string,
  nfeAssinada: string,
  prot: ReturnType<typeof lerProtocolo>,
  lote: { cStat: number; xMotivo: string },
): Promise<NfceResultado> {
  if (prot && autorizada(prot.cStat)) {
    const proc = montarNfeProc(nfeAssinada, prot.protNFe)
    const row = await prisma.nfceEmission.update({
      where: { id },
      data: { status: "AUTHORIZED", cStat: prot.cStat, motivo: prot.xMotivo, protocolo: prot.nProt, xml: proc, authorizedAt: new Date() },
    })
    let arquivo: string | undefined
    try {
      arquivo = arquivarXml(row.chave, "nfce", proc, row.createdAt)
    } catch {
      // o XML continua no banco; a pasta pode estar sem permissão
    }
    return resultado(row, arquivo)
  }
  const status = prot && denegada(prot.cStat) ? "DENIED" : "REJECTED"
  const row = await prisma.nfceEmission.update({
    where: { id },
    data: {
      status,
      cStat: (prot?.cStat ?? lote.cStat) || null,
      motivo: prot?.xMotivo ?? lote.xMotivo,
      protocolo: prot?.nProt ?? "",
    },
  })
  return resultado(row)
}
