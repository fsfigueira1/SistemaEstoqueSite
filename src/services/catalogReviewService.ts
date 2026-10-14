// Revisão do cadastro: monta o relatório (erros de digitação, espaços,
// duplicados, sem código) e aplica as correções que a pessoa marcou.
import { prisma } from '@/lib/prisma';
import { getSystemUserId } from '@/lib/systemUser';
import {
  applyNameFixes,
  findDuplicates,
  findSpacing,
  findTypos,
  type DuplicateGroup,
  type NameChange,
  type ReviewProduct,
  type TypoGroup,
} from '@/lib/catalogReview';

export interface CatalogReport {
  total: number;
  typos: TypoGroup[];
  spacing: NameChange[];
  duplicates: DuplicateGroup[];
  missingBarcode: ReviewProduct[];
}

export interface WordFix {
  wrong: string;
  right: string;
}

const BATCH = 50;

async function loadProducts(): Promise<ReviewProduct[]> {
  const rows = await prisma.product.findMany({
    select: {
      id: true,
      name: true,
      sku: true,
      barcode: true,
      status: true,
      stockQuantity: true,
      salePrice: true,
      category: { select: { name: true } },
    },
    orderBy: { name: 'asc' },
  });
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    sku: r.sku,
    barcode: r.barcode,
    status: r.status,
    stockQuantity: r.stockQuantity,
    salePrice: Number(r.salePrice),
    categoryName: r.category?.name ?? null,
  }));
}

/** Correção válida: palavra errada (normalizada) → grafia nova com letras. */
function cleanFixes(fixes: unknown): WordFix[] {
  if (!Array.isArray(fixes)) return [];
  return fixes
    .slice(0, 500)
    .map((f) => ({ wrong: String(f?.wrong ?? '').trim(), right: String(f?.right ?? '').trim() }))
    .filter((f) => f.wrong && f.right && f.right.length <= 60 && /\p{L}/u.test(f.right) && !/\s/.test(f.right));
}

export const CatalogReviewService = {
  async report(): Promise<CatalogReport> {
    const products = await loadProducts();
    return {
      total: products.length,
      typos: findTypos(products),
      spacing: findSpacing(products),
      duplicates: findDuplicates(products),
      missingBarcode: products.filter((p) => !(p.barcode ?? '').trim()),
    };
  },

  /**
   * Aplica as trocas de palavra (e a limpeza de espaços) nos nomes atuais do
   * banco — não confia no nome que a tela tinha. Registra o nome antigo no
   * histórico (AuditLog) para dar para desfazer. Devolve quantos mudaram.
   */
  async applyNames(rawFixes: unknown, spacing: boolean): Promise<number> {
    const fixes = cleanFixes(rawFixes);
    if (!fixes.length && !spacing) return 0;
    const products = await prisma.product.findMany({ select: { id: true, name: true } });
    const changes = products
      .map((p) => ({ id: p.id, from: p.name, to: applyNameFixes(p.name, fixes, spacing) }))
      .filter((c) => c.to && c.to !== c.from);
    if (!changes.length) return 0;

    const userId = await getSystemUserId();
    for (let i = 0; i < changes.length; i += BATCH) {
      const part = changes.slice(i, i + BATCH);
      await prisma.$transaction([
        ...part.map((c) => prisma.product.update({ where: { id: c.id }, data: { name: c.to } })),
        prisma.auditLog.createMany({
          data: part.map((c) => ({
            userId,
            action: 'RENAME',
            entity: 'Product',
            entityId: c.id,
            metadata: { from: c.from, to: c.to, source: 'revisao-cadastro' },
          })),
        }),
      ]);
    }
    return changes.length;
  },

  /** Desativa os duplicados escolhidos (some do PDV; nada é apagado). */
  async inactivate(rawIds: unknown): Promise<number> {
    const ids = Array.isArray(rawIds) ? [...new Set(rawIds.map(String))].slice(0, 500) : [];
    if (!ids.length) return 0;
    const r = await prisma.product.updateMany({ where: { id: { in: ids } }, data: { status: 'INACTIVE' } });
    return r.count;
  },
};
