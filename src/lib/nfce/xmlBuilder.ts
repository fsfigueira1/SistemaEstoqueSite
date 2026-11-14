// Monta o XML da NFC-e (modelo 65, versão 4.00) ainda sem assinatura.
// Ordem das tags conforme o leiaute (MOC 7.0 / NT vigentes). Sem banco, sem rede.
import { montarChave, sortearCodigoNumerico, CODIGO_UF } from "@/lib/nfce/chave"
import { cents, dataHoraSefaz, dec, onlyDigits, tagOpt, xmlText } from "@/lib/nfce/format"
import type { NfceDadosVenda, NfceItem } from "@/lib/nfce/types"

export const NFE_NS = "http://www.portalfiscal.inf.br/nfe"

/** Em homologação a SEFAZ exige este texto no 1º item e no nome do consumidor. */
export const TEXTO_HOMOLOGACAO = "NOTA FISCAL EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL"
/** Versão curta para o nome do consumidor (o campo aceita no máximo 60 letras). */
export const NOME_HOMOLOGACAO = "NF-E EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL"

/** Meios que levam o grupo <card> (pagamento eletrônico, sem integração com o PDV). */
const PAGAMENTO_ELETRONICO = new Set(["03", "04", "10", "11", "12", "13", "17", "18"])

/**
 * Divide um valor (em centavos) entre os itens, proporcional ao valor de
 * cada um. A sobra do arredondamento vai para o item mais caro, para a soma
 * bater exatamente com o total (a SEFAZ confere).
 */
export function ratear(totalCents: number, pesos: number[]): number[] {
  const soma = pesos.reduce((a, b) => a + b, 0)
  if (totalCents <= 0 || soma <= 0) return pesos.map(() => 0)
  const partes = pesos.map((p) => Math.floor((totalCents * p) / soma))
  let resto = totalCents - partes.reduce((a, b) => a + b, 0)
  const ordem = pesos.map((p, i) => [p, i] as const).sort((a, b) => b[0] - a[0])
  for (let k = 0; resto > 0; k = (k + 1) % ordem.length, resto--) partes[ordem[k][1]]++
  return partes
}

function grupoIcms(it: NfceItem): string {
  const orig = String(it.origem ?? 0)
  if (it.csosn === "500") return `<ICMS><ICMSSN500><orig>${orig}</orig><CSOSN>500</CSOSN></ICMSSN500></ICMS>`
  return `<ICMS><ICMSSN102><orig>${orig}</orig><CSOSN>${it.csosn}</CSOSN></ICMSSN102></ICMS>`
}

// Simples Nacional: PIS e COFINS são recolhidos no DAS, então vão zerados (CST 49).
const PIS_COFINS_SN =
  "<PIS><PISOutr><CST>49</CST><vBC>0.00</vBC><pPIS>0.0000</pPIS><vPIS>0.00</vPIS></PISOutr></PIS>" +
  "<COFINS><COFINSOutr><CST>49</CST><vBC>0.00</vBC><pCOFINS>0.0000</pCOFINS><vCOFINS>0.00</vCOFINS></COFINSOutr></COFINS>"

export interface NfceMontada {
  /** <NFe> sem assinatura e sem infNFeSupl. */
  xml: string
  chave: string
  /** Valor total da nota (vNF). */
  total: number
  /** Troco informado (vTroco). */
  troco: number
}

export function montarNfceXml(d: NfceDadosVenda): NfceMontada {
  if (!d.itens.length) throw new Error("A nota precisa de pelo menos um item")
  if (!d.pagamentos.length) throw new Error("A nota precisa de pelo menos uma forma de pagamento")
  const e = d.emitente
  const cUF = CODIGO_UF[e.uf]
  if (!cUF) throw new Error(`UF ${e.uf} não suportada`)

  const codigoNumerico = d.codigoNumerico ?? sortearCodigoNumerico(d.numero)
  const { chave, dv } = montarChave({
    uf: e.uf,
    emissao: d.emissao,
    cnpj: e.cnpj,
    serie: d.serie,
    numero: d.numero,
    codigoNumerico,
  })
  const homolog = d.ambiente === 2

  // ---- valores por item (tudo em centavos) ----
  const brutos = d.itens.map((it) => cents(it.quantidade * it.valorUnitario))
  const descItem = d.itens.map((it) => cents(it.desconto ?? 0))
  const liquidos = brutos.map((b, i) => b - descItem[i])
  const descRateio = ratear(cents(d.descontoTotal ?? 0), liquidos)
  const outroRateio = ratear(cents(d.acrescimoTotal ?? 0), liquidos)
  const vDescItens = descItem.map((v, i) => v + descRateio[i])

  const vProd = brutos.reduce((a, b) => a + b, 0)
  const vDesc = vDescItens.reduce((a, b) => a + b, 0)
  const vOutro = outroRateio.reduce((a, b) => a + b, 0)
  const vNF = vProd - vDesc + vOutro
  if (vNF <= 0) throw new Error("O total da nota precisa ser maior que zero")
  if (vDescItens.some((v, i) => v > brutos[i])) throw new Error("Desconto maior que o valor do item")

  const vPagTotal = d.pagamentos.reduce((a, p) => a + cents(p.valor), 0)
  if (vPagTotal < vNF) throw new Error("A soma dos pagamentos é menor que o total da nota")
  const vTroco = vPagTotal - vNF

  // ---- ide ----
  const ide =
    "<ide>" +
    `<cUF>${cUF}</cUF>` +
    `<cNF>${codigoNumerico}</cNF>` +
    "<natOp>VENDA</natOp>" +
    "<mod>65</mod>" +
    `<serie>${d.serie}</serie>` +
    `<nNF>${d.numero}</nNF>` +
    `<dhEmi>${dataHoraSefaz(d.emissao)}</dhEmi>` +
    "<tpNF>1</tpNF>" +
    "<idDest>1</idDest>" +
    `<cMunFG>${onlyDigits(e.cMun)}</cMunFG>` +
    "<tpImp>4</tpImp>" + // 4 = DANFE NFC-e
    "<tpEmis>1</tpEmis>" + // 1 = normal (on-line)
    `<cDV>${dv}</cDV>` +
    `<tpAmb>${d.ambiente}</tpAmb>` +
    "<finNFe>1</finNFe>" +
    "<indFinal>1</indFinal>" +
    "<indPres>1</indPres>" + // venda presencial
    "<procEmi>0</procEmi>" +
    `<verProc>${xmlText(d.versaoSistema, 20)}</verProc>` +
    "</ide>"

  // ---- emitente ----
  const emit =
    "<emit>" +
    `<CNPJ>${onlyDigits(e.cnpj)}</CNPJ>` +
    `<xNome>${xmlText(e.razaoSocial, 60)}</xNome>` +
    tagOpt("xFant", xmlText(e.nomeFantasia, 60)) +
    "<enderEmit>" +
    `<xLgr>${xmlText(e.logradouro, 60)}</xLgr>` +
    `<nro>${xmlText(e.numero, 60)}</nro>` +
    tagOpt("xCpl", xmlText(e.complemento, 60)) +
    `<xBairro>${xmlText(e.bairro, 60)}</xBairro>` +
    `<cMun>${onlyDigits(e.cMun)}</cMun>` +
    `<xMun>${xmlText(e.municipio, 60)}</xMun>` +
    `<UF>${e.uf}</UF>` +
    `<CEP>${onlyDigits(e.cep)}</CEP>` +
    "<cPais>1058</cPais><xPais>BRASIL</xPais>" +
    tagOpt("fone", onlyDigits(e.fone)) +
    "</enderEmit>" +
    `<IE>${onlyDigits(e.ie)}</IE>` +
    `<CRT>${e.crt}</CRT>` +
    "</emit>"

  // ---- destinatário (opcional na NFC-e) ----
  let dest = ""
  const doc = onlyDigits(d.consumidorDoc)
  if (doc) {
    const nome = homolog ? NOME_HOMOLOGACAO : xmlText(d.consumidorNome, 60)
    dest =
      "<dest>" +
      (doc.length === 14 ? `<CNPJ>${doc}</CNPJ>` : `<CPF>${doc}</CPF>`) +
      tagOpt("xNome", nome) +
      "<indIEDest>9</indIEDest>" +
      "</dest>"
  }

  // ---- itens ----
  const dets = d.itens
    .map((it, i) => {
      const ean = onlyDigits(it.ean)
      const gtin = [8, 12, 13, 14].includes(ean.length) ? ean : "SEM GTIN"
      const desc = homolog && i === 0 ? TEXTO_HOMOLOGACAO : xmlText(it.descricao, 120)
      const unidade = xmlText(it.unidade || "UN", 6)
      const qCom = dec(it.quantidade, 4)
      const vUn = dec(it.valorUnitario, 2)
      return (
        `<det nItem="${i + 1}">` +
        "<prod>" +
        `<cProd>${xmlText(it.codigo, 60)}</cProd>` +
        `<cEAN>${gtin}</cEAN>` +
        `<xProd>${desc}</xProd>` +
        `<NCM>${onlyDigits(it.ncm)}</NCM>` +
        tagOpt("CEST", onlyDigits(it.cest)) +
        `<CFOP>${onlyDigits(it.cfop)}</CFOP>` +
        `<uCom>${unidade}</uCom>` +
        `<qCom>${qCom}</qCom>` +
        `<vUnCom>${vUn}</vUnCom>` +
        `<vProd>${dec(brutos[i] / 100)}</vProd>` +
        `<cEANTrib>${gtin}</cEANTrib>` +
        `<uTrib>${unidade}</uTrib>` +
        `<qTrib>${qCom}</qTrib>` +
        `<vUnTrib>${vUn}</vUnTrib>` +
        (vDescItens[i] > 0 ? `<vDesc>${dec(vDescItens[i] / 100)}</vDesc>` : "") +
        (outroRateio[i] > 0 ? `<vOutro>${dec(outroRateio[i] / 100)}</vOutro>` : "") +
        "<indTot>1</indTot>" +
        "</prod>" +
        "<imposto>" +
        grupoIcms(it) +
        PIS_COFINS_SN +
        "</imposto>" +
        "</det>"
      )
    })
    .join("")

  // ---- totais ----
  const total =
    "<total><ICMSTot>" +
    "<vBC>0.00</vBC><vICMS>0.00</vICMS><vICMSDeson>0.00</vICMSDeson><vFCP>0.00</vFCP>" +
    "<vBCST>0.00</vBCST><vST>0.00</vST><vFCPST>0.00</vFCPST><vFCPSTRet>0.00</vFCPSTRet>" +
    `<vProd>${dec(vProd / 100)}</vProd>` +
    "<vFrete>0.00</vFrete><vSeg>0.00</vSeg>" +
    `<vDesc>${dec(vDesc / 100)}</vDesc>` +
    "<vII>0.00</vII><vIPI>0.00</vIPI><vIPIDevol>0.00</vIPIDevol><vPIS>0.00</vPIS><vCOFINS>0.00</vCOFINS>" +
    `<vOutro>${dec(vOutro / 100)}</vOutro>` +
    `<vNF>${dec(vNF / 100)}</vNF>` +
    "</ICMSTot></total>"

  const transp = "<transp><modFrete>9</modFrete></transp>"

  const pag =
    "<pag>" +
    d.pagamentos
      .map(
        (p) =>
          "<detPag>" +
          `<tPag>${p.tPag}</tPag>` +
          (p.tPag === "99" ? "<xPag>Outros</xPag>" : "") +
          `<vPag>${dec(p.valor)}</vPag>` +
          (PAGAMENTO_ELETRONICO.has(p.tPag) ? "<card><tpIntegra>2</tpIntegra></card>" : "") +
          "</detPag>",
      )
      .join("") +
    (vTroco > 0 ? `<vTroco>${dec(vTroco / 100)}</vTroco>` : "") +
    "</pag>"

  const infAdic = d.informacoesComplementares
    ? `<infAdic><infCpl>${xmlText(d.informacoesComplementares, 5000)}</infCpl></infAdic>`
    : ""

  const rt = d.responsavelTecnico
  const infRespTec =
    rt && onlyDigits(rt.cnpj)
      ? "<infRespTec>" +
        `<CNPJ>${onlyDigits(rt.cnpj)}</CNPJ>` +
        `<xContato>${xmlText(rt.contato, 60)}</xContato>` +
        `<email>${xmlText(rt.email, 60)}</email>` +
        `<fone>${onlyDigits(rt.fone)}</fone>` +
        "</infRespTec>"
      : ""

  const xml =
    `<NFe xmlns="${NFE_NS}">` +
    `<infNFe versao="4.00" Id="NFe${chave}">` +
    ide +
    emit +
    dest +
    dets +
    total +
    transp +
    pag +
    infAdic +
    infRespTec +
    "</infNFe>" +
    "</NFe>"

  return { xml, chave, total: vNF / 100, troco: vTroco / 100 }
}
