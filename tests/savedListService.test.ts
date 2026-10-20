import { describe, beforeEach, it, expect } from 'vitest';
import { SavedListService, type SaveListInput } from '../src/services/savedListService';
import { prisma } from './setup';
import { cleanupDatabase } from './utils';

describe('SavedListService', () => {
  let pLapis: { id: string };
  let pCola: { id: string };
  let base: SaveListInput;

  beforeEach(async () => {
    await cleanupDatabase();
    const category = await prisma.category.create({ data: { name: 'Escolar' } });
    pLapis = await prisma.product.create({
      data: { name: 'Lápis HB', sku: 'LAPIS01', categoryId: category.id, salePrice: 2.5, stockQuantity: 50 },
    });
    pCola = await prisma.product.create({
      data: { name: 'Cola branca', sku: 'COLA01', categoryId: category.id, salePrice: 4, stockQuantity: 10 },
    });
    base = {
      schoolName: 'Colégio São José',
      grade: '3º ano',
      schoolYear: 2027,
      sourceText: '2 lápis\n1 cola',
      items: [
        { raw: '2 lápis', text: 'lápis', qty: 2, productId: pLapis.id },
        { raw: '1 cola', text: 'cola', qty: 1, productId: pCola.id },
      ],
    };
  });

  it('saveList cria escola e lista com código', async () => {
    const s = await SavedListService.saveList({ ...base, items: [base.items[0]] });
    expect(s.schoolSlug).toBe('colegio-sao-jose');
    expect(s.code).toMatch(/^L-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{4}$/);
    expect(s.itemCount).toBe(1);
  });

  it('saveList reuses school by slug', async () => {
    await SavedListService.saveList({ ...base, schoolName: 'Colégio São José', grade: '3º ano' });
    await SavedListService.saveList({ ...base, schoolName: ' colegio sao jose ', grade: '4º ano' });
    expect(await SavedListService.listSchools()).toHaveLength(1);
  });

  it('saveList twice keeps code and replaces items', async () => {
    const a = await SavedListService.saveList(base);
    const b = await SavedListService.saveList({ ...base, items: [base.items[0]] });
    expect(b.id).toBe(a.id);
    expect(b.code).toBe(a.code);
    expect(b.itemCount).toBe(1);
  });

  it('getQuote recalcula com preço atual', async () => {
    const s = await SavedListService.saveList({ ...base, items: [base.items[0]] });
    await prisma.product.update({ where: { id: pLapis.id }, data: { salePrice: 9.9 } });
    const q = await SavedListService.getQuote(s.code);
    expect(q!.lines[0].product!.salePrice).toBe(9.9);
  });

  it('getQuote treats inactive product as missing', async () => {
    const s = await SavedListService.saveList({ ...base, items: [base.items[0]] });
    await prisma.product.update({ where: { id: pLapis.id }, data: { status: 'INACTIVE' } });
    expect((await SavedListService.getQuote(s.id))!.lines[0].product).toBeNull();
  });

  it('getQuote activeOnly hides inactive list', async () => {
    const s = await SavedListService.saveList(base);
    await SavedListService.setActive(s.id, false);
    expect(await SavedListService.getQuote(s.code, { activeOnly: true })).toBeNull();
    expect(await SavedListService.getQuote(s.code)).not.toBeNull();
  });

  it('saveList rejeita série vazia, ano fora de 2000–2100 e lista sem itens', async () => {
    await expect(SavedListService.saveList({ ...base, grade: '  ' })).rejects.toThrow('Informe a série');
    await expect(SavedListService.saveList({ ...base, schoolYear: 1999 })).rejects.toThrow('Ano letivo inválido');
    await expect(SavedListService.saveList({ ...base, items: [] })).rejects.toThrow('A lista está vazia');
  });
});
