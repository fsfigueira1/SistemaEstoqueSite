import { describe, expect, it } from "vitest"
import { chaveBarras, gtinValido, itensDaNotaCompra, juntarPorEan } from "@/lib/ncmFromNfe"

const det = (n: number, prod: string) => `<det nItem="${n}"><prod>${prod}</prod><imposto></imposto></det>`
const nota = (...dets: string[]) =>
  `<?xml version="1.0"?><nfeProc versao="4.00" xmlns="http://www.portalfiscal.inf.br/nfe"><NFe><infNFe Id="NFe1">${dets.join("")}</infNFe></NFe></nfeProc>`

describe("NCM pelas notas de compra", () => {
  it("valida GTIN pelo dígito verificador", () => {
    expect(gtinValido("4006381333931")).toBe(true)
    expect(gtinValido("4006381333932")).toBe(false)
    expect(gtinValido("96385074")).toBe(true)
    expect(gtinValido("SEM GTIN")).toBe(false)
    expect(gtinValido("0000000000000")).toBe(false)
  })

  it("lê código de barras, NCM, CEST e nome de cada item", () => {
    const xml = nota(
      det(1, "<cProd>A1</cProd><cEAN>4006381333931</cEAN><xProd>CANETA AZUL &amp; CIA</xProd><NCM>96081000</NCM><CEST>1902300</CEST><cEANTrib>4006381333931</cEANTrib>"),
      det(2, "<cProd>A2</cProd><cEAN>SEM GTIN</cEAN><xProd>SEM CODIGO</xProd><NCM>48201000</NCM><cEANTrib>SEM GTIN</cEANTrib>"),
      det(3, "<cProd>A3</cProd><cEAN>SEM GTIN</cEAN><xProd>SO NO TRIB</xProd><NCM>4820.20.00</NCM><cEANTrib>96385074</cEANTrib>"),
      det(4, "<cProd>A4</cProd><cEAN>4006381333931</cEAN><xProd>SERVICO</xProd><NCM>00</NCM>"),
    )
    expect(itensDaNotaCompra(xml, "a.xml")).toEqual([
      { ean: "4006381333931", ncm: "96081000", cest: "1902300", nome: "CANETA AZUL & CIA", arquivo: "a.xml" },
      { ean: "96385074", ncm: "48202000", cest: "", nome: "SO NO TRIB", arquivo: "a.xml" },
    ])
  })

  it("ignora XML que não é nota (evento, resumo)", () => {
    expect(itensDaNotaCompra("<procEventoNFe><evento/></procEventoNFe>")).toEqual([])
  })

  it("junta notas: fica o NCM mais frequente e avisa quando divergem", () => {
    const it = (ncm: string, arquivo: string, ean = "4006381333931") => ({ ean, ncm, cest: "", nome: "CANETA", arquivo })
    const r = juntarPorEan([it("96081000", "a"), it("96081000", "b"), it("96089989", "c"), it("48202000", "d", "96385074")])
    expect(r).toHaveLength(2)
    expect(r[0]).toMatchObject({ ean: "4006381333931", ncm: "96081000", outrosNcm: ["96089989"], arquivos: 3 })
    expect(r[1]).toMatchObject({ ean: "96385074", ncm: "48202000", outrosNcm: [] })
  })

  it("compara código de barras sem zeros à esquerda", () => {
    expect(chaveBarras("07891234567895")).toBe(chaveBarras("7891234567895"))
    expect(chaveBarras(null)).toBe("")
  })
})
