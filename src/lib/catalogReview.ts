// Revisão do cadastro: acha erro de digitação nos nomes ("CANTENA" →
// "CANETA"), espaços sobrando, nomes duplicados e produtos sem código.
// Pura — a tela mostra, o servidor aplica as correções escolhidas.
import { buildVocabulary, editDistance, normalizeText, stem } from './smartSearch';

export interface ReviewProduct {
  id: string;
  name: string;
  sku: string;
  barcode: string | null;
  status: string;
  stockQuantity: number;
  salePrice: number;
  categoryName: string | null;
}

export interface NameChange {
  id: string;
  name: string;
  fixed: string;
}

export interface TypoGroup {
  /** palavra errada, normalizada (chave da correção) */
  wrong: string;
  /** como aparece no cadastro */
  wrongDisplay: string;
  /** grafia sugerida (a mais usada no catálogo) */
  right: string;
  /** quantas vezes a grafia certa aparece — mostra por que é a certa */
  rightCount: number;
  products: NameChange[];
}

export interface DuplicateGroup {
  key: string;
  products: ReviewProduct[];
}

// Palavra é "erro" quando é rara e quase igual a uma bem mais comum.
const MAX_WRONG_COUNT = 8;
const MIN_RATIO = 3;
// dois erros na mesma palavra só com a certa MUITO mais comum (CANTENA × CANETA 49x)
const MIN_RATIO_2_TYPOS = 10;

const WORD_RE = /[\p{L}\p{N}]+/gu;

/** Copia maiúsculas/minúsculas da palavra original ("CANTENA" → "CANETA"). */
export function matchCase(original: string, word: string): string {
  if (original === original.toUpperCase()) return word.toUpperCase();
  if (original[0] === original[0].toUpperCase()) return word[0].toUpperCase() + word.slice(1).toLowerCase();
  return word.toLowerCase();
}

/** Troca a palavra inteira (sem acento/caixa) mantendo o estilo do nome. */
export function replaceWord(name: string, wrong: string, right: string): string {
  return name.replace(WORD_RE, (tok) => (normalizeText(tok) === wrong ? matchCase(tok, right) : tok));
}

/** Espaços duplos, no começo/fim e antes de pontuação. */
export function tidySpaces(name: string): string {
  return name.replace(/\s+/g, ' ').replace(/\s+([,.;:)])/g, '$1').replace(/\(\s+/g, '(').trim();
}

function maxTypos(len: number): number {
  return len >= 7 ? 2 : 1;
}

/** Palavras curtas: só conta se começo e fim batem (POLOT/PILOT sim; FINA/FINE, MAPA/CAPA não). */
function shortWordOk(w: string, k: string): boolean {
  return w.length > 5 || (w[0] === k[0] && w[w.length - 1] === k[k.length - 1]);
}

/** Outras palavras (3+ letras, sem números) que aparecem junto com cada palavra. */
function contextMap(names: string[]): Map<string, Set<string>> {
  const ctx = new Map<string, Set<string>>();
  for (const name of names) {
    const words = [...new Set((name.match(WORD_RE) ?? []).map(normalizeText))].filter((w) => w.length >= 3 && !/\d/.test(w));
    for (const w of words) {
      const set = ctx.get(w) ?? new Set<string>();
      for (const o of words) if (o !== w) set.add(o);
      ctx.set(w, set);
    }
  }
  return ctx;
}

/** Aparecem em produtos parecidos? (mesma marca, mesmo tipo…) — evita MARIA → MARCA. */
function sameContext(ctx: Map<string, Set<string>>, w: string, k: string): boolean {
  const a = ctx.get(w);
  const b = ctx.get(k);
  if (!a || !b) return false;
  for (const x of a) if (b.has(x)) return true;
  return false;
}

/** Erros de digitação prováveis, cada um com os produtos afetados. */
export function findTypos(products: Array<Pick<ReviewProduct, 'id' | 'name'>>): TypoGroup[] {
  const vocab = buildVocabulary(products.map((p) => p.name));
  const words = [...vocab.entries()];
  const ctx = contextMap(products.map((p) => p.name));
  const fixes = new Map<string, { right: string; rightCount: number }>();

  for (const [w, { count }] of words) {
    if (count > MAX_WRONG_COUNT || w.length < 4) continue;
    let best: { key: string; count: number } | null = null;
    for (const [k, info] of words) {
      if (k === w || info.count < count * MIN_RATIO) continue;
      if (stem(k) === stem(w)) continue; // plural/gênero, não é erro
      if (!shortWordOk(w, k)) continue;
      const d = editDistance(w, k, maxTypos(w.length));
      if (d > maxTypos(w.length) || (d === 2 && info.count < count * MIN_RATIO_2_TYPOS)) continue;
      if (!sameContext(ctx, w, k)) continue;
      if (!best || info.count > best.count) best = { key: k, count: info.count };
    }
    if (best) fixes.set(w, { right: vocab.get(best.key)?.display ?? best.key, rightCount: best.count });
  }

  const groups: TypoGroup[] = [];
  for (const [wrong, fix] of fixes) {
    const hit = products.filter((p) => (p.name.match(WORD_RE) ?? []).some((t) => normalizeText(t) === wrong));
    if (!hit.length) continue;
    const sample = (hit[0].name.match(WORD_RE) ?? []).find((t) => normalizeText(t) === wrong) ?? wrong;
    groups.push({
      wrong,
      wrongDisplay: sample,
      right: fix.right,
      rightCount: fix.rightCount,
      products: hit.map((p) => ({ id: p.id, name: p.name, fixed: replaceWord(p.name, wrong, fix.right) })),
    });
  }
  return groups.sort((a, b) => b.products.length - a.products.length || a.wrong.localeCompare(b.wrong));
}

/** Nomes com espaço sobrando. */
export function findSpacing(products: Array<Pick<ReviewProduct, 'id' | 'name'>>): NameChange[] {
  return products.flatMap((p) => {
    const fixed = tidySpaces(p.name);
    return fixed === p.name ? [] : [{ id: p.id, name: p.name, fixed }];
  });
}

/** Chave para comparar nomes: sem acento, caixa, pontuação e espaços. */
export function duplicateKey(name: string): string {
  return normalizeText(name).replace(/[^a-z0-9]+/g, ' ').trim();
}

/** Produtos com o mesmo nome (ignorando acento, caixa e pontuação). */
export function findDuplicates(products: ReviewProduct[]): DuplicateGroup[] {
  const byKey = new Map<string, ReviewProduct[]>();
  for (const p of products) {
    const key = duplicateKey(p.name);
    if (!key) continue;
    byKey.set(key, [...(byKey.get(key) ?? []), p]);
  }
  return [...byKey.entries()]
    .filter(([, list]) => list.length > 1)
    .map(([key, list]) => ({ key, products: list }))
    .sort((a, b) => a.key.localeCompare(b.key));
}

/**
 * Aplica as correções escolhidas a um nome (palavras + espaços).
 * Devolve o nome novo (igual ao antigo se nada mudou).
 */
export function applyNameFixes(name: string, fixes: Array<{ wrong: string; right: string }>, spacing: boolean): string {
  let out = name;
  for (const f of fixes) out = replaceWord(out, f.wrong, f.right);
  return spacing ? tidySpaces(out) : out;
}
