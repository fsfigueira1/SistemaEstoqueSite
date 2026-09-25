import { describe, it, expect } from "vitest"
import { backupDay, backupFileName, filesToPrune, newestFirst, orderTables, stripSecrets } from "./backupFormat"

describe("backup", () => {
  it("nomeia o arquivo com data e hora local", () => {
    const d = new Date(2026, 8, 5, 7, 3)
    expect(backupFileName(d)).toBe("lacolaria-backup-2026-09-05-0703.json.gz")
    expect(backupFileName(d, 2)).toBe("lacolaria-backup-2026-09-05-0703-2.json.gz")
    expect(backupDay("lacolaria-backup-2026-09-05-0703.json.gz")).toBe("2026-09-05")
    expect(backupDay("outra-coisa.json.gz")).toBeNull()
    expect(backupDay("lacolaria-backup-../../x.json.gz")).toBeNull()
  })

  it("restaura pais antes dos filhos", () => {
    const order = orderTables(
      ["SaleItem", "Sale", "Product", "Category", "User", "Settings"],
      [
        { child: "SaleItem", parent: "Sale" },
        { child: "SaleItem", parent: "Product" },
        { child: "Sale", parent: "User" },
        { child: "Product", parent: "Category" },
        { child: "Product", parent: "Product" },
      ],
    )
    const at = (t: string) => order.indexOf(t)
    expect(order).toHaveLength(6)
    expect(at("Category")).toBeLessThan(at("Product"))
    expect(at("Product")).toBeLessThan(at("SaleItem"))
    expect(at("User")).toBeLessThan(at("Sale"))
    expect(at("Sale")).toBeLessThan(at("SaleItem"))
  })

  it("não leva as chaves de API", () => {
    const rows = stripSecrets("Settings", [{ id: "app", aiApiKey: "sk-ant-x", shoppingApiKey: "abc", companyName: "L" }])
    expect(rows[0]).toEqual({ id: "app", aiApiKey: "", shoppingApiKey: "", companyName: "L" })
    expect(stripSecrets("Product", [{ id: "1" }])).toEqual([{ id: "1" }])
  })

  it("mantém só os mais novos e nunca mexe em outros arquivos", () => {
    const names = [
      "lacolaria-backup-2026-09-01-1000.json.gz",
      "lacolaria-backup-2026-09-03-1000.json.gz",
      "lacolaria-backup-2026-09-02-1000.json.gz",
      "minha-planilha.xlsx",
    ]
    expect(filesToPrune(names, 2)).toEqual(["lacolaria-backup-2026-09-01-1000.json.gz"])
    expect(filesToPrune(names, 0)).toHaveLength(2)
  })

  it("guarda por dia: backup manual no mesmo dia não empurra um dia para fora", () => {
    const names = [
      "lacolaria-backup-2026-09-01-1000.json.gz",
      "lacolaria-backup-2026-09-02-1000.json.gz",
      "lacolaria-backup-2026-09-02-1500.json.gz",
      "lacolaria-backup-2026-09-02-1700.json.gz",
    ]
    expect(filesToPrune(names, 2)).toEqual([])
    expect(filesToPrune(names, 1)).toEqual(["lacolaria-backup-2026-09-01-1000.json.gz"])
  })

  it("dois backups no mesmo minuto: o de sufixo é o mais novo", () => {
    expect(
      newestFirst([
        "lacolaria-backup-2026-09-25-0009.json.gz",
        "lacolaria-backup-2026-09-25-0009-3.json.gz",
        "lacolaria-backup-2026-09-25-0009-2.json.gz",
        "lacolaria-backup-2026-09-24-2300.json.gz",
      ]),
    ).toEqual([
      "lacolaria-backup-2026-09-25-0009-3.json.gz",
      "lacolaria-backup-2026-09-25-0009-2.json.gz",
      "lacolaria-backup-2026-09-25-0009.json.gz",
      "lacolaria-backup-2026-09-24-2300.json.gz",
    ])
  })
})
