// Estoque no carrinho do PDV: o que está faltando e o aviso do servidor de
// que um produto acabou (outro caixa vendeu antes). Testado em cartStock.test.ts.

type CartLine = { id: string; nome: string; quantidade: number; estoque: number; avulso?: boolean }

/** Itens pedindo mais do que há em estoque (avulso não tem estoque). */
export function stockShortages<T extends CartLine>(cart: T[]) {
  return cart
    .filter((i) => !i.avulso && i.quantidade > i.estoque)
    .map((i) => ({ id: i.id, nome: i.nome, quantidade: i.quantidade, estoque: i.estoque }))
}

/** O servidor recusou a venda por estoque: o item passa a mostrar o estoque real. */
export function applyStockShortage<T extends CartLine>(cart: T[], s: { productId: string; available: number }): T[] {
  if (!cart.some((i) => i.id === s.productId)) return cart
  return cart.map((i) => (i.id === s.productId ? { ...i, estoque: Math.max(0, s.available) } : i))
}

/** Erro de estoque com o produto e quanto ainda tem (o PDV mostra no carrinho). */
export class InsufficientStockError extends Error {
  readonly code = "INSUFFICIENT_STOCK"
  constructor(
    readonly productId: string,
    readonly productName: string,
    readonly available: number,
    requested: number,
  ) {
    // a mensagem em inglês é a que o resto do sistema (e os testes) já conhece
    super(`Insufficient stock for product ${productName}. Available: ${available}, requested: ${requested}`)
    this.name = "InsufficientStockError"
  }
}
