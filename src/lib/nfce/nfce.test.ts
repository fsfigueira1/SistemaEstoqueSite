import { describe, expect, it } from "vitest"
import forge from "node-forge"
import { digitoVerificador, montarChave } from "@/lib/nfce/chave"
import { lerCertificado } from "@/lib/nfce/certificate"
import { assinarXml, assinaturaValida } from "@/lib/nfce/signer"
import { montarNfceXml, ratear, TEXTO_HOMOLOGACAO } from "@/lib/nfce/xmlBuilder"
import { grupoInfNFeSupl, montarQrCode } from "@/lib/nfce/qrcode"
import { lerProtocolo, montarNfeProc, tagTexto } from "@/lib/nfce/sefaz"
import { montarEventoCancelamento } from "@/lib/nfce/evento"
import { cnpjValido, cpfValido, dataHoraSefaz, xmlText } from "@/lib/nfce/format"
import type { NfceDadosVenda } from "@/lib/nfce/types"

// Certificado de teste gerado na hora (nunca um certificado real).
function pfxDeTeste(senha: string): Buffer {
  const keys = forge.pki.rsa.generateKeyPair(1024)
  const cert = forge.pki.createCertificate()
  cert.publicKey = keys.publicKey
  cert.serialNumber = "01"
  cert.validity.notBefore = new Date("2026-01-01T00:00:00Z")
  cert.validity.notAfter = new Date("2027-01-01T00:00:00Z")
  const attrs = [{ name: "commonName", value: "LOJA TESTE LTDA:11222333000181" }]
  cert.setSubject(attrs)
  cert.setIssuer(attrs)
  cert.sign(keys.privateKey, forge.md.sha256.create())
  const p12 = forge.pkcs12.toPkcs12Asn1(keys.privateKey, [cert], senha, { algorithm: "3des" })
  return Buffer.from(forge.asn1.toDer(p12).getBytes(), "binary")
}

const venda = (over: Partial<NfceDadosVenda> = {}): NfceDadosVenda => ({
  ambiente: 2,
  serie: 1,
  numero: 123,
  emissao: new Date("2026-11-14T13:30:00Z"), // 10:30 em Brasília
  codigoNumerico: "12345678",
  versaoSistema: "Koda 0.7.0",
  emitente: {
    cnpj: "11.222.333/0001-81",
    ie: "123.456.789.110",
    razaoSocial: "Loja Teste Ltda",
    nomeFantasia: "Laçolaria",
    crt: 1,
    logradouro: "Rua A & B",
    numero: "10",
    bairro: "Centro",
    cMun: "3550308",
    municipio: "São Paulo",
    uf: "SP",
    cep: "01001-000",
  },
  itens: [
    { codigo: "1", ean: "7891234567895", descricao: "Caderno", ncm: "48202000", cfop: "5102", unidade: "UN", quantidade: 2, valorUnitario: 10, origem: 0, csosn: "102" },
    { codigo: "2", descricao: "Caneta <azul>", ncm: "96081000", cfop: "5102", unidade: "UN", quantidade: 1, valorUnitario: 5.5, origem: 0, csosn: "102" },
  ],
  pagamentos: [{ tPag: "01", valor: 30 }],
  ...over,
})

describe("chave de acesso", () => {
  it("tem 44 dígitos e DV módulo 11", () => {
    const { chave, dv } = montarChave({ uf: "SP", emissao: new Date("2026-11-14T13:30:00Z"), cnpj: "11222333000181", serie: 1, numero: 123, codigoNumerico: "12345678" })
    expect(chave).toHaveLength(44)
    expect(chave.startsWith("352611112223330001816500100000012311234567")).toBe(true)
    expect(digitoVerificador(chave.slice(0, 43))).toBe(dv)
    expect(Number(chave[43])).toBe(dv)
  })
  it("resto 0 ou 1 vira DV 0", () => {
    // "1" -> soma 2 -> resto 2 -> 9; tudo zero -> resto 0 -> 0
    expect(digitoVerificador("1")).toBe(9)
    expect(digitoVerificador("0".repeat(43))).toBe(0)
  })
})

describe("documentos e datas", () => {
  it("valida CPF e CNPJ", () => {
    expect(xmlText("Cola Confetti Acrilex 95 g – Tutti-Frutti “Ultra” … ✨")).toBe("Cola Confetti Acrilex 95 g - Tutti-Frutti &quot;Ultra&quot; ...")
    expect(xmlText("Lápis Ação Çedilha")).toBe("Lápis Ação Çedilha")
    expect(cpfValido("529.982.247-25")).toBe(true)
    expect(cpfValido("111.111.111-11")).toBe(false)
    expect(cnpjValido("11.222.333/0001-81")).toBe(true)
    expect(cnpjValido("11.222.333/0001-80")).toBe(false)
  })
  it("data no fuso de Brasília", () => {
    expect(dataHoraSefaz(new Date("2026-11-14T13:30:05Z"))).toBe("2026-11-14T10:30:05-03:00")
  })
})

describe("rateio", () => {
  it("soma exatamente o total", () => {
    const r = ratear(100, [3333, 3333, 3334])
    expect(r.reduce((a, b) => a + b, 0)).toBe(100)
    expect(ratear(0, [1, 2])).toEqual([0, 0])
  })
})

describe("XML da NFC-e", () => {
  it("monta totais, troco e homologação", () => {
    const r = montarNfceXml(venda())
    expect(r.total).toBe(25.5)
    expect(r.troco).toBe(4.5)
    expect(r.xml).toContain(`<xProd>${TEXTO_HOMOLOGACAO}</xProd>`)
    expect(r.xml).toContain("<xProd>Caneta &lt;azul&gt;</xProd>")
    expect(r.xml).toContain("<xLgr>Rua A &amp; B</xLgr>")
    expect(r.xml).toContain("<dhEmi>2026-11-14T10:30:00-03:00</dhEmi>")
    expect(r.xml).toContain("<vNF>25.50</vNF>")
    expect(r.xml).toContain("<vTroco>4.50</vTroco>")
    expect(r.xml).toContain("<cEAN>SEM GTIN</cEAN>")
    expect(r.xml).toContain("<cEAN>7891234567895</cEAN>")
    expect(r.xml).toContain(`Id="NFe${r.chave}"`)
    expect(r.xml).not.toContain("<dest>")
  })

  it("rateia desconto e juros e fecha o vNF", () => {
    const r = montarNfceXml(
      venda({ ambiente: 1, descontoTotal: 1.5, acrescimoTotal: 0.99, pagamentos: [{ tPag: "03", valor: 24.99 }] }),
    )
    expect(tagTexto(r.xml, "vNF")).toBe("24.99")
    const descs = [...r.xml.matchAll(/<det [\s\S]*?<vDesc>([\d.]+)<\/vDesc>/g)].map((m) => Number(m[1]))
    expect(descs.reduce((a, b) => a + b, 0)).toBeCloseTo(1.5, 2)
    expect(r.xml).toContain("<card><tpIntegra>2</tpIntegra></card>")
    expect(r.xml).toContain("<xProd>Caderno</xProd>")
  })

  it("leva o CPF do consumidor", () => {
    const r = montarNfceXml(venda({ ambiente: 1, consumidorDoc: "529.982.247-25", consumidorNome: "Maria" }))
    expect(r.xml).toContain("<dest><CPF>52998224725</CPF><xNome>Maria</xNome><indIEDest>9</indIEDest></dest>")
  })

  it("recusa pagamento menor que o total", () => {
    expect(() => montarNfceXml(venda({ pagamentos: [{ tPag: "01", valor: 10 }] }))).toThrow(/pagamentos/)
  })
})

describe("QR Code", () => {
  const chave = "35261111222333000181650010000001231123456785"
  it("versão 2 com hash do CSC", () => {
    const qr = montarQrCode(chave, 2, { versao: 2, idCsc: "000001", csc: "ABCDEF" })
    expect(qr).toMatch(/^https:\/\/www\.homologacao\.nfce\.fazenda\.sp\.gov\.br\/qrcode\?p=3526\d{40}\|2\|2\|1\|[0-9A-F]{40}$/)
  })
  it("versão 3 sem CSC", () => {
    expect(montarQrCode(chave, 1, { versao: 3 })).toBe(`https://www.nfce.fazenda.sp.gov.br/qrcode?p=${chave}|3|1`)
  })
  it("versão 2 sem CSC dá erro claro", () => {
    expect(() => montarQrCode(chave, 1, { versao: 2 })).toThrow(/CSC/)
  })
})

describe("assinatura", () => {
  const cert = lerCertificado(pfxDeTeste("1234"), "1234")

  it("lê o certificado e o CNPJ", () => {
    expect(cert.cnpj).toBe("11222333000181")
    expect(cert.validoAte.getUTCFullYear()).toBe(2027)
  })

  it("senha errada dá erro claro", () => {
    expect(() => lerCertificado(pfxDeTeste("1234"), "errada")).toThrow(/senha/)
  })

  it("assina infNFe e continua válida com o infNFeSupl no meio", () => {
    const { xml, chave } = montarNfceXml(venda())
    const assinado = assinarXml(xml, "infNFe", "NFe", cert)
    expect(assinado).toMatch(/<\/infNFe><Signature xmlns="http:\/\/www\.w3\.org\/2000\/09\/xmldsig#">/)
    expect(assinado).toContain(`<Reference URI="#NFe${chave}">`)
    expect(assinado).toContain('<SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1"/>')
    expect(assinado).toContain("<X509Certificate>")
    expect(assinaturaValida(assinado, cert)).toBe(true)

    const supl = grupoInfNFeSupl("https://x/qrcode?p=1|2", 2, 2)
    const comSupl = assinado.replace("<Signature", `${supl}<Signature`)
    expect(assinaturaValida(comSupl, cert)).toBe(true)
    expect(assinaturaValida(comSupl.replace("<vNF>25.50</vNF>", "<vNF>1.00</vNF>"), cert)).toBe(false)
  })

  it("assina o evento de cancelamento", () => {
    const ev = montarEventoCancelamento({
      ambiente: 2,
      cnpj: "11222333000181",
      chave: "35261111222333000181650010000001231123456785",
      protocolo: "135260000000001",
      justificativa: "Cliente desistiu da compra",
      quando: new Date("2026-11-14T13:40:00Z"),
    })
    const assinado = assinarXml(ev, "infEvento", "evento", cert)
    expect(assinado).toContain('Id="ID1101113526111122233300018165001000000123112345678501"')
    expect(assinaturaValida(assinado, cert)).toBe(true)
    expect(() => montarEventoCancelamento({ ambiente: 2, cnpj: "1", chave: "1", protocolo: "1", justificativa: "curta", quando: new Date() })).toThrow(/15/)
  })
})

describe("retorno da SEFAZ", () => {
  it("lê o protocolo e monta o nfeProc", () => {
    const ret =
      '<soap:Envelope><soap:Body><nfeResultMsg><retEnviNFe xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00"><tpAmb>2</tpAmb><cStat>104</cStat><xMotivo>Lote processado</xMotivo>' +
      '<protNFe versao="4.00"><infProt><tpAmb>2</tpAmb><chNFe>3526</chNFe><dhRecbto>2026-11-14T10:30:02-03:00</dhRecbto><nProt>135260000000001</nProt><digVal>x</digVal><cStat>100</cStat><xMotivo>Autorizado o uso da NF-e</xMotivo></infProt></protNFe>' +
      "</retEnviNFe></nfeResultMsg></soap:Body></soap:Envelope>"
    const p = lerProtocolo(ret)
    if (!p) throw new Error("protocolo não lido")
    expect(p.cStat).toBe(100)
    expect(p.nProt).toBe("135260000000001")
    const proc = montarNfeProc("<NFe>x</NFe>", p.protNFe)
    expect(proc).toMatch(/^<\?xml[^>]+\?><nfeProc versao="4.00" xmlns="http:\/\/www\.portalfiscal\.inf\.br\/nfe"><NFe>x<\/NFe><protNFe/)
  })
})
