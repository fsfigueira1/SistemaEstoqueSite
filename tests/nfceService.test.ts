// NFC-e de ponta a ponta contra um Postgres local (nunca o da loja — ver dbGuard):
// venda -> nota assinada -> "SEFAZ" simulada -> XML salvo -> DANFE -> cancelamento.
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import forge from "node-forge"
import { prisma } from "@/lib/prisma"
import { NfceService } from "@/services/nfceService"
import { salvarCertificado } from "@/lib/nfce/localStore"
import { getServerSettings, SETTINGS_ID } from "@/lib/serverSettings"
import { SefazSemResposta, tagTexto, type Transporte } from "@/lib/nfce/sefaz"

const temBanco = Boolean(process.env.DATABASE_URL)
const CNPJ = "11222333000181"

function pfxDeTeste(senha: string): Buffer {
  const keys = forge.pki.rsa.generateKeyPair(1024)
  const cert = forge.pki.createCertificate()
  cert.publicKey = keys.publicKey
  cert.serialNumber = "01"
  cert.validity.notBefore = new Date(Date.now() - 86400_000)
  cert.validity.notAfter = new Date(Date.now() + 365 * 86400_000)
  const attrs = [{ name: "commonName", value: `LOJA TESTE LTDA:${CNPJ}` }]
  cert.setSubject(attrs)
  cert.setIssuer(attrs)
  cert.sign(keys.privateKey, forge.md.sha256.create())
  const p12 = forge.pkcs12.toPkcs12Asn1(keys.privateKey, [cert], senha, { algorithm: "3des" })
  return Buffer.from(forge.asn1.toDer(p12).getBytes(), "binary")
}

// "SEFAZ" de mentira: responde conforme o modo e guarda o que recebeu
let modo: "autoriza" | "rejeita" | "cai" = "autoriza"
const recebidos: string[] = []
const sefaz: Transporte = async (url, _action, body) => {
  recebidos.push(body)
  if (modo === "cai") throw new SefazSemResposta("A SEFAZ demorou mais de 30 s para responder")
  const chave = (body.match(/Id="NFe(\d{44})"/) ?? body.match(/<chNFe>(\d{44})<\/chNFe>/) ?? [])[1] ?? ""
  if (url.endsWith("NFeRecepcaoEvento4.asmx")) {
    return `<soap:Envelope><soap:Body><nfeResultMsg><retEnvEvento><cStat>128</cStat><retEvento versao="1.00"><infEvento><cStat>135</cStat><xMotivo>Evento registrado e vinculado a NF-e</xMotivo><chNFe>${chave}</chNFe><nProt>135260000000999</nProt></infEvento></retEvento></retEnvEvento></nfeResultMsg></soap:Body></soap:Envelope>`
  }
  if (url.endsWith("NFeConsultaProtocolo4.asmx")) {
    return `<soap:Envelope><soap:Body><retConsSitNFe><cStat>217</cStat><xMotivo>Rejeicao: NF-e nao consta na base de dados da SEFAZ</xMotivo></retConsSitNFe></soap:Body></soap:Envelope>`
  }
  const prot =
    modo === "autoriza"
      ? `<protNFe versao="4.00"><infProt><tpAmb>2</tpAmb><chNFe>${chave}</chNFe><dhRecbto>2026-11-14T10:30:02-03:00</dhRecbto><nProt>135260000000${String(recebidos.length).padStart(3, "0")}</nProt><cStat>100</cStat><xMotivo>Autorizado o uso da NF-e</xMotivo></infProt></protNFe>`
      : `<protNFe versao="4.00"><infProt><tpAmb>2</tpAmb><chNFe>${chave}</chNFe><cStat>778</cStat><xMotivo>Rejeicao: Informado NCM inexistente</xMotivo></infProt></protNFe>`
  return `<soap:Envelope><soap:Body><nfeResultMsg><retEnviNFe versao="4.00"><cStat>104</cStat><xMotivo>Lote processado</xMotivo>${prot}</retEnviNFe></nfeResultMsg></soap:Body></soap:Envelope>`
}

async function novaVenda() {
  const user = await prisma.user.upsert({
    where: { email: "nfce@teste.local" },
    update: {},
    create: { name: "Teste", email: "nfce@teste.local", password: "x", role: "OWNER" },
  })
  const cat = await prisma.category.create({ data: { name: `Cat ${Date.now()}` } })
  const reg = await prisma.cashRegister.create({ data: { name: "Caixa" } })
  const ses = await prisma.cashSession.create({
    data: { cashRegisterId: reg.id, openedById: user.id, openedAt: new Date(), openingAmount: 0 },
  })
  const prod = await prisma.product.create({
    data: { name: "Caderno 10 matérias", sku: `SKU-${Math.random()}`, categoryId: cat.id, salePrice: 10, ncm: "48202000" },
  })
  return prisma.sale.create({
    data: {
      saleNumber: `V-${Math.random()}`,
      cashSessionId: ses.id,
      createdById: user.id,
      status: "COMPLETED",
      subtotal: 25.5,
      totalAmount: 25.5,
      items: {
        create: [
          { productId: prod.id, quantity: 2, unitPrice: 10, totalAmount: 20 },
          { productName: "Laço avulso", quantity: 1, unitPrice: 5.5, totalAmount: 5.5 },
        ],
      },
      payments: { create: [{ method: "CASH", amount: 30, changeAmount: 4.5, status: "PAID", processedById: user.id }] },
    },
  })
}

describe.skipIf(!temBanco)("NFC-e (serviço + banco local)", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "nfce-teste-"))

  beforeAll(async () => {
    process.env.AUTH_SECRET = "segredo-de-teste-com-mais-de-32-caracteres"
    process.env.LACOLARIA_FISCAL_DIR = path.join(dir, "privado")
    process.env.LACOLARIA_FISCAL_XML_DIR = path.join(dir, "xml")
    await getServerSettings()
    await NfceService.saveConfig(
      {
        enabled: true,
        ambiente: 2,
        serie: 1,
        numeroInicial: 1,
        emitente: {
          cnpj: CNPJ,
          ie: "123456789110",
          razaoSocial: "Loja Teste Ltda",
          crt: 1,
          logradouro: "Rua A",
          numero: "1",
          bairro: "Centro",
          cMun: "3550308",
          municipio: "São Paulo",
          cep: "01001000",
        },
        idCsc: "000001",
        qrVersao: 2,
        ncmPadrao: "48209000",
      },
      "CSC-DE-TESTE",
    )
    salvarCertificado(pfxDeTeste("1234"), "1234")
  })

  afterAll(async () => {
    await prisma.settings.update({ where: { id: SETTINGS_ID }, data: { nfceConfig: "{}", nfceCsc: "" } })
    fs.rmSync(dir, { recursive: true, force: true })
  })

  it("configuração completa e sem o CSC na resposta", async () => {
    const c = await NfceService.getConfig()
    expect(c.faltando).toEqual([])
    expect(c.cscSet).toBe(true)
    expect(JSON.stringify(c)).not.toContain("CSC-DE-TESTE")
    expect(c.certificado?.cnpj).toBe(CNPJ)
  })

  it("emite, salva o XML na pasta do mês e não emite de novo", async () => {
    modo = "autoriza"
    const venda = await novaVenda()
    const r = await NfceService.emitirParaVenda(venda.id, { consumidorDoc: "529.982.247-25" }, sefaz)
    expect(r.status).toBe("AUTHORIZED")
    expect(r.arquivo && fs.existsSync(r.arquivo)).toBe(true)
    const xml = fs.readFileSync(r.arquivo as string, "utf8")
    expect(xml).toContain("<nfeProc")
    expect(xml).toContain("<nProt>")
    expect(tagTexto(xml, "vNF")).toBe("25.50")
    expect(tagTexto(xml, "vTroco")).toBe("4.50")
    expect(xml).toContain("<NCM>48209000</NCM>") // item avulso usa o NCM padrão
    expect(xml).toContain("<CPF>52998224725</CPF>")

    const enviados = recebidos.length
    const deNovo = await NfceService.emitirParaVenda(venda.id, {}, sefaz)
    expect(deNovo.id).toBe(r.id)
    expect(recebidos.length).toBe(enviados) // não mandou outra nota

    const danfe = await NfceService.danfe(r.id)
    expect(danfe).toContain("<svg")
    expect(danfe).toContain("@page { size: 80mm auto; margin: 0; }")
    expect(danfe).toContain("Protocolo de autorização")
    expect(danfe).toContain("HOMOLOGAÇÃO")
  })

  it("número da rejeitada é reaproveitado; o da autorizada não", async () => {
    modo = "rejeita"
    const v1 = await novaVenda()
    const rej = await NfceService.emitirParaVenda(v1.id, {}, sefaz)
    expect(rej.status).toBe("REJECTED")
    expect(rej.cStat).toBe(778)
    modo = "autoriza"
    const ok = await NfceService.emitirParaVenda(v1.id, {}, sefaz)
    expect(ok.status).toBe("AUTHORIZED")
    expect(ok.numero).toBe(rej.numero)
    const v2 = await novaVenda()
    const ok2 = await NfceService.emitirParaVenda(v2.id, {}, sefaz)
    expect(ok2.numero).toBe(ok.numero + 1)
  })

  it("sem resposta fica pendente; a consulta libera o número", async () => {
    modo = "cai"
    const v = await novaVenda()
    const p = await NfceService.emitirParaVenda(v.id, {}, sefaz)
    expect(p.status).toBe("PENDING")
    modo = "autoriza"
    const c = await NfceService.consultar(p.id, sefaz)
    expect(c.status).toBe("REJECTED") // 217: a SEFAZ não recebeu
  })

  it("cancela com justificativa e guarda o XML do evento", async () => {
    modo = "autoriza"
    const v = await novaVenda()
    const r = await NfceService.emitirParaVenda(v.id, {}, sefaz)
    await expect(NfceService.cancelar(r.id, "curta", sefaz)).rejects.toThrow(/15/)
    const c = await NfceService.cancelar(r.id, "Cliente desistiu da compra", sefaz)
    expect(c.status).toBe("CANCELLED")
    const row = await prisma.nfceEmission.findUnique({ where: { id: r.id } })
    expect(row?.cancelXml).toContain("<procEventoNFe")
    expect(await NfceService.danfe(r.id)).toContain("NFC-e CANCELADA")
  })
})
