// Etiquetas de gôndola: promoção ("de / por"), controle do que já foi impresso
// e códigos de barras internos para produtos sem código.
import { prisma } from '@/lib/prisma';
import { ensureSchema } from '@/lib/schemaUpgrade';
import {
  dateToPromoDay,
  effectiveCompareAt,
  internalEan13,
  labelState,
  nextInternalSeq,
  promoDayToDate,
  type LabelState,
} from '@/lib/labels';

const num = (v: unknown): number | null => (v == null ? null : Number(v));

export interface LabelInfo {
  productId: string;
  compareAtPrice: number | null;
  promoUntil: string | null; // "AAAA-MM-DD"
  /** "de" que vai na etiqueta hoje (0 = sem promoção) */
  activeCompareAt: number;
  state: LabelState;
  labelPrintedAt: string | null;
}

export const LabelService = {
  /** Situação da etiqueta de todos os produtos (ou só dos ids pedidos). */
  async getInfo(productIds?: string[]): Promise<LabelInfo[]> {
    await ensureSchema();
    const products = await prisma.product.findMany({
      where: productIds ? { id: { in: productIds } } : undefined,
      select: { id: true, salePrice: true, label: true },
    });
    return products.map((p) => {
      const price = Number(p.salePrice);
      const l = p.label;
      const compareAt = num(l?.compareAtPrice);
      const activeCompareAt = effectiveCompareAt(compareAt, price, l?.promoUntil ?? null);
      return {
        productId: p.id,
        compareAtPrice: compareAt,
        promoUntil: dateToPromoDay(l?.promoUntil ?? null),
        activeCompareAt,
        state: labelState(
          { price, compareAt: activeCompareAt },
          l ? { labelPrice: num(l.labelPrice), labelCompareAt: num(l.labelCompareAt), labelPrintedAt: l.labelPrintedAt } : null,
        ),
        labelPrintedAt: l?.labelPrintedAt?.toISOString() ?? null,
      };
    });
  },

  /** Produtos ativos cuja etiqueta impressa não bate mais com o preço. */
  async getStale(): Promise<{ changed: Array<{ id: string; name: string }>; never: number }> {
    await ensureSchema();
    const active = await prisma.product.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
    const info = new Map((await LabelService.getInfo(active.map((p) => p.id))).map((i) => [i.productId, i]));
    const changed = active.filter((p) => info.get(p.id)?.state === 'changed');
    const never = active.filter((p) => info.get(p.id)?.state === 'never').length;
    return { changed, never };
  },

  /**
   * Define (ou limpa, com compareAtPrice nulo) a promoção. O "por" é sempre o
   * preço de venda — é o que o PDV cobra, então etiqueta e caixa nunca divergem.
   */
  async setPromo(productId: string, compareAtPrice: number | null, promoUntil: string | null) {
    await ensureSchema();
    const product = await prisma.product.findUnique({ where: { id: productId }, select: { salePrice: true } });
    if (!product) throw new Error('Produto não encontrado');
    const de = compareAtPrice && compareAtPrice > 0 ? compareAtPrice : null;
    if (de != null && Math.round(de * 100) <= Math.round(Number(product.salePrice) * 100)) {
      throw new Error('O preço "de" da promoção precisa ser maior que o preço de venda');
    }
    let until: Date | null = null;
    if (de != null && promoUntil) {
      until = promoDayToDate(promoUntil);
      if (!until) throw new Error('Data final da promoção inválida');
    }
    await prisma.productLabel.upsert({
      where: { productId },
      create: { productId, compareAtPrice: de, promoUntil: until },
      update: { compareAtPrice: de, promoUntil: until },
    });
  },

  /**
   * Registra que as etiquetas foram impressas, com o preço que está no banco
   * agora (não confia no que a tela mandou).
   */
  async markPrinted(productIds: string[]): Promise<number> {
    await ensureSchema();
    const ids = [...new Set(productIds)].slice(0, 5000);
    if (!ids.length) return 0;
    const info = new Map((await LabelService.getInfo(ids)).map((i) => [i.productId, i]));
    const products = await prisma.product.findMany({ where: { id: { in: ids } }, select: { id: true, salePrice: true } });
    const now = new Date();
    await prisma.$transaction(
      products.map((p) => {
        const data = {
          labelPrice: p.salePrice,
          labelCompareAt: info.get(p.id)?.activeCompareAt ?? 0,
          labelPrintedAt: now,
        };
        return prisma.productLabel.upsert({ where: { productId: p.id }, create: { productId: p.id, ...data }, update: data });
      }),
    );
    return products.length;
  },

  /** Próximo código EAN-13 interno livre (prefixo 20). */
  async nextBarcode(): Promise<string> {
    const rows = await prisma.product.findMany({
      where: { barcode: { startsWith: '20' } },
      select: { barcode: true },
    });
    return internalEan13(nextInternalSeq(rows.map((r) => r.barcode)));
  },

  /**
   * Dá um código de barras interno para cada produto sem código. O SKU
   * continua valendo no leitor do PDV, então nada que já foi impresso quebra.
   */
  async generateMissingBarcodes(): Promise<number> {
    const missing = await prisma.product.findMany({
      where: { OR: [{ barcode: null }, { barcode: '' }] },
      select: { id: true },
      orderBy: { name: 'asc' },
    });
    if (!missing.length) return 0;
    const rows = await prisma.product.findMany({ where: { barcode: { startsWith: '20' } }, select: { barcode: true } });
    let seq = nextInternalSeq(rows.map((r) => r.barcode));
    let done = 0;
    for (const p of missing) {
      // outro PC pode ter usado o mesmo número: tenta o próximo
      for (let attempt = 0; attempt < 20; attempt++) {
        try {
          await prisma.product.update({ where: { id: p.id }, data: { barcode: internalEan13(seq++) } });
          done++;
          break;
        } catch (err) {
          if (!/unique|P2002/i.test(String((err as { code?: string })?.code ?? err))) throw err;
        }
      }
    }
    return done;
  },
}
