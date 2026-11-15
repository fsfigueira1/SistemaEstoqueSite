// Emissão da NFC-e de uma venda: assinatura, envio à SEFAZ-SP, consulta,
// cancelamento e DANFE. Numeração e gravação ficam em nfceRegistro.ts.
import { prisma } from "@/lib/prisma"
import { ensureSchema } from "@/lib/schemaUpgrade"
import { getServerSettings, SETTINGS_ID } from "@/lib/serverSettings"
import { normalizarConfig, problemasConfig, type NfceConfig } from "@/lib/nfce/config"
import { montarNfceXml } from "@/lib/nfce/xmlBuilder"
import { assinarXml } from "@/lib/nfce/signer"
import { grupoInfNFeSupl, montarQrCode } from "@/lib/nfce/qrcode"
import {
  chamarSefaz,
  consultaChave,
  consultaRecibo,
  consultaStatus,
  lerProtocolo,
  loteAutorizacao,
  SefazSemResposta,
  tagCompleta,
  tagTexto,
  type Transporte,
} from "@/lib/nfce/sefaz"
import { eventoRegistrado, loteEvento, montarEventoCancelamento, montarProcEvento } from "@/lib/nfce/evento"
import { arquivarXml, carregarCertificado } from "@/lib/nfce/localStore"
import { cnpjValido, cpfValido, onlyDigits } from "@/lib/nfce/format"
import { partesDaVenda } from "@/lib/nfce/fromSale"
import { montarDanfeHtml } from "@/lib/nfce/danfe"
import type { CertificadoA1 } from "@/lib/nfce/certificate"
import type { ReceiptWidth } from "@/lib/thermalPrint"
import {
  aplicarProtocolo,
  exigirCertificado,
  NfceErro,
  reservarNumero,
  resultado,
  type NfceResultado,
} from "@/services/nfceRegistro"

export { NfceErro, type NfceResultado, type NfceStatus } from "@/services/nfceRegistro"

const VERSAO = `Koda ${process.env.npm_package_version || ""}`.trim()
const idLote = () => String(Date.now()).slice(-15)

async function lerConfig(): Promise<{ cfg: NfceConfig; csc: string }> {
  const s = await getServerSettings()
  return { cfg: normalizarConfig(s.nfceConfig), csc: (s.nfceCsc ?? "").trim() }
}

/** Monta, assina e coloca o QR Code; devolve a <NFe> pronta para enviar. */
function nfePronta(
  cfg: NfceConfig,
  csc: string,
  cert: CertificadoA1,
  dados: Omit<Parameters<typeof montarNfceXml>[0], "ambiente" | "serie" | "emitente" | "versaoSistema">,
) {
  const m = montarNfceXml({
    ...dados,
    ambiente: cfg.ambiente,
    serie: cfg.serie,
    emitente: cfg.emitente,
    informacoesComplementares: cfg.informacoesComplementares || undefined,
    responsavelTecnico: cfg.respTecCnpj
      ? { cnpj: cfg.respTecCnpj, contato: cfg.respTecContato, email: cfg.respTecEmail, fone: cfg.respTecFone }
      : undefined,
    versaoSistema: VERSAO,
  })
  const assinada = assinarXml(m.xml, "infNFe", "NFe", cert)
  const qr = montarQrCode(m.chave, cfg.ambiente, { versao: cfg.qrVersao, idCsc: cfg.idCsc, csc })
  const xml = assinada.replace("<Signature", grupoInfNFeSupl(qr, cfg.ambiente, cfg.qrVersao) + "<Signature")
  return { chave: m.chave, xml, total: m.total }
}

/** Lote 103 (processamento assíncrono): busca o resultado pelo número do recibo. */
async function aguardarRecibo(cfg: NfceConfig, cert: CertificadoA1, ret: string, transporte?: Transporte) {
  const nRec = tagTexto(tagCompleta(ret, "infRec"), "nRec")
  for (let i = 0; i < 4 && nRec; i++) {
    await new Promise((r) => setTimeout(r, 1500 * (i + 1)))
    try {
      const prot = lerProtocolo(await chamarSefaz("retAutorizacao", cfg.ambiente, consultaRecibo(cfg.ambiente, nRec), cert, transporte))
      if (prot) return prot
    } catch (e) {
      if (!(e instanceof SefazSemResposta)) throw e
    }
  }
  return null
}

export const NfceService = {
  /** Configuração para a tela (sem o CSC). */
  async getConfig() {
    const { cfg, csc } = await lerConfig()
    let cert: { titular: string; cnpj: string; validoAte: string; vencido: boolean } | null = null
    let certErro = ""
    try {
      const c = carregarCertificado()
      if (c) cert = { titular: c.titular, cnpj: c.cnpj, validoAte: c.validoAte.toISOString(), vencido: c.validoAte.getTime() < Date.now() }
    } catch (e) {
      certErro = e instanceof Error ? e.message : String(e)
    }
    return { config: cfg, cscSet: csc.length > 0, certificado: cert, certificadoErro: certErro, faltando: problemasConfig(cfg, csc.length > 0) }
  },

  async saveConfig(raw: unknown, csc?: string) {
    await getServerSettings() // garante o schema e a linha de configurações
    const data: { nfceConfig: string; nfceCsc?: string } = { nfceConfig: JSON.stringify(normalizarConfig(raw)) }
    if (typeof csc === "string" && csc.trim()) data.nfceCsc = csc.trim()
    await prisma.settings.update({ where: { id: SETTINGS_ID }, data })
    return this.getConfig()
  },

  /** Status do serviço da SEFAZ (107 = em operação). */
  async statusSefaz(transporte?: Transporte) {
    const { cfg } = await lerConfig()
    const cert = exigirCertificado(cfg)
    const ret = await chamarSefaz("status", cfg.ambiente, consultaStatus(cfg.ambiente), cert, transporte)
    return { cStat: Number(tagTexto(ret, "cStat")), motivo: tagTexto(ret, "xMotivo"), ambiente: cfg.ambiente }
  },

  async listarPorVenda(saleId: string) {
    await ensureSchema()
    const rows = await prisma.nfceEmission.findMany({ where: { saleId }, orderBy: { createdAt: "desc" } })
    return rows.map((r) => resultado(r))
  },

  /** O que a tela do PDV/Vendas precisa: se a emissão está ligada e as notas da venda. */
  async painelDaVenda(saleId: string) {
    const { cfg } = await lerConfig()
    return { enabled: cfg.enabled, ambiente: cfg.ambiente, notas: await this.listarPorVenda(saleId) }
  },

  async listar(limit = 50) {
    await ensureSchema()
    const rows = await prisma.nfceEmission.findMany({ orderBy: { createdAt: "desc" }, take: Math.min(200, Math.max(1, limit)) })
    return rows.map((r) => ({ ...resultado(r), total: r.total.toNumber(), saleId: r.saleId, createdAt: r.createdAt }))
  },

  /** Emite a NFC-e de uma venda concluída. Se já tem nota autorizada, devolve a mesma. */
  async emitirParaVenda(
    saleId: string,
    opts: { consumidorDoc?: string; consumidorNome?: string } = {},
    transporte?: Transporte,
  ): Promise<NfceResultado> {
    await ensureSchema()
    const { cfg, csc } = await lerConfig()
    if (!cfg.enabled) throw new NfceErro("A emissão de NFC-e está desligada (Configurações → Nota fiscal)")
    const faltando = problemasConfig(cfg, csc.length > 0)
    if (faltando.length) throw new NfceErro(`Falta preencher na configuração fiscal: ${faltando.join(", ")}`)

    const anteriores = await prisma.nfceEmission.findMany({ where: { saleId }, orderBy: { createdAt: "desc" } })
    const valida = anteriores.find((r) => r.status === "AUTHORIZED")
    if (valida) return resultado(valida)
    const pendente = anteriores.find((r) => r.status === "PENDING")
    if (pendente) {
      // a anterior ficou sem resposta: primeiro descobre se ela foi autorizada
      const r = await this.consultar(pendente.id, transporte)
      if (r.status === "AUTHORIZED" || r.status === "PENDING") return r
    }

    const cert = exigirCertificado(cfg)
    const doc = onlyDigits(opts.consumidorDoc)
    if (doc && !(doc.length === 11 ? cpfValido(doc) : cnpjValido(doc))) throw new NfceErro("CPF/CNPJ do consumidor inválido")

    const sale = await prisma.sale.findUnique({
      where: { id: saleId },
      include: { items: { include: { product: true } }, payments: true },
    })
    if (!sale) throw new NfceErro("Venda não encontrada")
    if (sale.status !== "COMPLETED") throw new NfceErro("Só dá para emitir NFC-e de venda concluída")
    const partes = partesDaVenda(sale, cfg)
    if (partes.semNcm.length) {
      throw new NfceErro(
        `Produto sem NCM: ${partes.semNcm.slice(0, 5).join(", ")}. Cadastre o NCM no produto ou um NCM padrão na configuração fiscal.`,
      )
    }

    const emissao = new Date()
    let enviada = ""
    const row = await reservarNumero(
      cfg,
      (numero) => {
        const n = nfePronta(cfg, csc, cert, {
          numero,
          emissao,
          consumidorDoc: doc || undefined,
          consumidorNome: opts.consumidorNome,
          itens: partes.itens,
          pagamentos: partes.pagamentos,
          descontoTotal: partes.descontoTotal,
          acrescimoTotal: partes.acrescimoTotal,
        })
        enviada = n.xml
        return n
      },
      saleId,
      doc,
    )

    let ret: string
    try {
      ret = await chamarSefaz("autorizacao", cfg.ambiente, loteAutorizacao(enviada, idLote()), cert, transporte)
    } catch (e) {
      if (!(e instanceof SefazSemResposta)) throw e
      return resultado(await prisma.nfceEmission.update({ where: { id: row.id }, data: { motivo: e.message } }))
    }

    const lote = { cStat: Number(tagTexto(ret, "cStat")), xMotivo: tagTexto(ret, "xMotivo") }
    let prot = lerProtocolo(ret)
    if (!prot && lote.cStat === 103) {
      prot = await aguardarRecibo(cfg, cert, ret, transporte)
      if (!prot) {
        const r = await prisma.nfceEmission.update({ where: { id: row.id }, data: { motivo: "Lote recebido, aguardando a SEFAZ processar" } })
        return resultado(r)
      }
    }
    return aplicarProtocolo(row.id, enviada, prot, lote)
  },

  /** Consulta na SEFAZ uma nota sem resposta (as outras já têm o status final). */
  async consultar(id: string, transporte?: Transporte): Promise<NfceResultado> {
    await ensureSchema()
    const row = await prisma.nfceEmission.findUnique({ where: { id } })
    if (!row) throw new NfceErro("Nota não encontrada")
    if (row.status !== "PENDING") return resultado(row)
    const { cfg } = await lerConfig()
    const cert = exigirCertificado(cfg)
    const amb = row.ambiente === 1 ? 1 : 2
    let ret: string
    try {
      ret = await chamarSefaz("consulta", amb, consultaChave(amb, row.chave), cert, transporte)
    } catch (e) {
      if (e instanceof SefazSemResposta) return resultado({ ...row, motivo: e.message })
      throw e
    }
    const prot = lerProtocolo(ret)
    const cStat = Number(tagTexto(ret, "cStat"))
    const xMotivo = tagTexto(ret, "xMotivo")
    if (prot) return aplicarProtocolo(row.id, row.xml, prot, { cStat, xMotivo })
    // 217 = a SEFAZ não tem esta nota: nunca chegou lá, então o número pode ser reaproveitado
    if (cStat === 217) {
      return resultado(await prisma.nfceEmission.update({ where: { id }, data: { status: "REJECTED", cStat, motivo: xMotivo } }))
    }
    return resultado({ ...row, cStat, motivo: xMotivo })
  },

  /** Cancela uma NFC-e autorizada (a SEFAZ só aceita dentro do prazo legal). */
  async cancelar(id: string, justificativa: string, transporte?: Transporte): Promise<NfceResultado> {
    await ensureSchema()
    const row = await prisma.nfceEmission.findUnique({ where: { id } })
    if (!row) throw new NfceErro("Nota não encontrada")
    if (row.status === "CANCELLED") return resultado(row)
    if (row.status !== "AUTHORIZED" || !row.protocolo) throw new NfceErro("Só dá para cancelar nota autorizada")
    if (String(justificativa ?? "").trim().length < 15) throw new NfceErro("A justificativa do cancelamento precisa ter pelo menos 15 letras")
    const { cfg } = await lerConfig()
    const cert = exigirCertificado(cfg)
    const amb = row.ambiente === 1 ? 1 : 2
    const evento = assinarXml(
      montarEventoCancelamento({ ambiente: amb, cnpj: cfg.emitente.cnpj, chave: row.chave, protocolo: row.protocolo, justificativa, quando: new Date() }),
      "infEvento",
      "evento",
      cert,
    )
    let ret: string
    try {
      ret = await chamarSefaz("evento", amb, loteEvento(evento, idLote()), cert, transporte)
    } catch (e) {
      if (e instanceof SefazSemResposta) throw new NfceErro(`${e.message}. Tente cancelar de novo.`)
      throw e
    }
    const retEvento = tagCompleta(ret, "retEvento")
    const inf = tagCompleta(retEvento, "infEvento")
    const cStat = Number(tagTexto(inf, "cStat") || tagTexto(ret, "cStat"))
    const motivo = tagTexto(inf, "xMotivo") || tagTexto(ret, "xMotivo")
    if (!eventoRegistrado(cStat)) throw new NfceErro(`A SEFAZ recusou o cancelamento: ${cStat} - ${motivo}`)
    const proc = montarProcEvento(evento, retEvento.replace(/<(\/?)\w+:/g, "<$1"))
    const upd = await prisma.nfceEmission.update({
      where: { id },
      data: { status: "CANCELLED", cancelXml: proc, cancelReason: justificativa.trim(), cancelledAt: new Date(), motivo },
    })
    try {
      arquivarXml(row.chave, "canc", proc, row.createdAt)
    } catch {
      // continua no banco
    }
    return resultado(upd)
  },

  async danfe(id: string, width: ReceiptWidth = "80mm", via?: string): Promise<string> {
    await ensureSchema()
    const row = await prisma.nfceEmission.findUnique({ where: { id } })
    if (!row) throw new NfceErro("Nota não encontrada")
    if (row.status !== "AUTHORIZED" && row.status !== "CANCELLED") throw new NfceErro("Nota sem autorização: não tem DANFE")
    return montarDanfeHtml(row.xml, { width, cancelada: row.status === "CANCELLED", via })
  },

  async xml(id: string): Promise<{ nome: string; xml: string }> {
    await ensureSchema()
    const row = await prisma.nfceEmission.findUnique({ where: { id } })
    if (!row) throw new NfceErro("Nota não encontrada")
    return { nome: `${row.chave}-nfce.xml`, xml: row.xml }
  },
}
