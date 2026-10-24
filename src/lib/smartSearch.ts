// Busca "inteligente" de produtos: as palavras valem em qualquer ordem
// ("caderno batman" acha "Caderno Tilibra Batman"), sem acento, sem
// diferença de plural/gênero ("canetas pretas" = "caneta preta"), aceita
// começo de palavra ("cad") e um erro de digitação ("cadreno").
//
// Pura (sem React/banco): a mesma regra roda no navegador, no servidor e no
// cache offline do PDV.

// Palavras que não ajudam a achar nada.
const STOP_WORDS = new Set(['de', 'da', 'do', 'das', 'dos', 'com', 'e', 'para', 'pra', 'em', 'a', 'o', 'as', 'os', 'um', 'uma', 'c']);

// Quando a busca exata acha menos que isso, completa com os "quase".
const MAX_STRICT_FOR_EXTRA = 10;
const MAX_EXTRA = 12;

/** Minúsculas, sem acento. */
export function normalizeText(v: unknown): string {
  return String(v ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

/**
 * Reduz plural e gênero: canetas → canet, preta/preto → pret,
 * cadernos → cadern. Aplicada igual no texto e na busca, então basta ser
 * consistente (não precisa ser gramática correta).
 */
export function stem(word: string): string {
  let w = word;
  if (/^\d/.test(w)) return w; // números e códigos ficam como estão
  if (w.length > 4 && /[aeo]is$/.test(w)) w = `${w.slice(0, -2)}l`; // pastéis → pastel, jornais → jornal
  else if (w.length > 4 && w.endsWith('oes')) w = `${w.slice(0, -3)}ao`; // cartões → cartao
  else if (w.length > 4 && w.endsWith('aes')) w = `${w.slice(0, -3)}ao`;
  else if (w.length > 4 && /[rz]es$/.test(w)) w = w.slice(0, -2); // cores → cor
  else if (w.length > 3 && w.endsWith('s')) w = w.slice(0, -1);
  if (w.length > 4 && /[ao]$/.test(w)) w = w.slice(0, -1);
  return w;
}

/** Quebra em palavras; também separa letra de número ("0.7mm" → 0, 7, mm). */
export function tokenize(text: string): string[] {
  return normalizeText(text)
    .split(/[^a-z0-9]+|(?<=\d)(?=[a-z])|(?<=[a-z])(?=\d)/)
    .filter(Boolean);
}

/** Distância de edição (com troca de letras vizinhas), parando cedo acima de `max`. */
export function editDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const prev2: number[] = new Array(b.length + 1).fill(0);
  let prev: number[] = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur: number[] = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prev2[j - 2] + 1);
      cur[j] = v;
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > max) return max + 1;
    for (let j = 0; j <= b.length; j++) prev2[j] = prev[j];
    prev = cur;
  }
  return prev[b.length];
}

/** Erros aceitos conforme o tamanho da palavra digitada. */
function allowedTypos(len: number): number {
  if (len >= 8) return 2;
  if (len >= 5) return 1;
  return 0;
}

interface QueryToken {
  raw: string; // como foi digitado (normalizado)
  stem: string;
}

export function parseQuery(query: string): QueryToken[] {
  const words = tokenize(query);
  const useful = words.filter((w) => !STOP_WORDS.has(w));
  return (useful.length ? useful : words).map((raw) => ({ raw, stem: stem(raw) }));
}

/** Pontua uma palavra da busca contra as palavras de um produto (0 = não casa). */
function tokenScore(t: QueryToken, words: string[], compact: string): number {
  let best = 0;
  const typos = allowedTypos(t.raw.length);
  for (const w of words) {
    if (w === t.stem) return 10;
    if (t.raw.length >= 2 && w.startsWith(t.stem)) best = Math.max(best, 7);
    // meio da palavra só para termo longo ("grafica" em "esferografica");
    // curto casaria demais ("cola" em "escolar")
    else if (t.stem.length >= 6 && w.includes(t.stem)) best = Math.max(best, 4);
    else if (best < 3 && typos && /[a-z]/.test(t.stem)) {
      // erro de digitação: compara com a palavra toda ou com o começo dela
      // (quem ainda está digitando "cadre" quer "caderno")
      const d = Math.min(
        editDistance(t.stem, w, typos),
        w.length > t.stem.length ? editDistance(t.stem, w.slice(0, t.stem.length), typos) : typos + 1,
      );
      if (d <= typos) best = Math.max(best, 3 - d);
    }
  }
  // códigos digitados pela metade (SKU, código de barras)
  if (!best && t.raw.length >= 3 && /\d/.test(t.raw) && compact.includes(t.raw)) best = 4;
  return best;
}

interface IndexedDoc<T> {
  item: T;
  words: string[];
  compact: string;
  /** primeira palavra do nome (ex.: "caderno") — bônus quando a busca começa por ela */
  head: string;
  name: string;
}

export interface SearchIndex<T> {
  /** Itens que casam, do mais parecido para o menos. Busca vazia devolve tudo. strict: só os que têm todas as palavras. */
  search: (query: string, opts?: { strict?: boolean }) => T[];
}

/**
 * Monta o índice uma vez (useMemo) e busca a cada tecla.
 * `fields` devolve os textos pesquisáveis; o 1º deve ser o nome.
 */
export function buildSearchIndex<T>(items: T[], fields: (item: T) => Array<string | null | undefined>): SearchIndex<T> {
  const docs: IndexedDoc<T>[] = items.map((item) => {
    const texts = fields(item).map((f) => f ?? '');
    const words = [...new Set(texts.flatMap((f) => tokenize(f)).map(stem))];
    const compact = texts.map((f) => normalizeText(f).replace(/[^a-z0-9]/g, '')).join(' ');
    return { item, words, compact, head: stem(tokenize(texts[0] ?? '')[0] ?? ''), name: texts[0] ?? '' };
  });

  return {
    search(query: string, opts?: { strict?: boolean }): T[] {
      const tokens = parseQuery(query);
      if (!tokens.length) return items;

      // nota de cada palavra da busca em cada produto
      const scores = docs.map((d) => tokens.map((t) => tokenScore(t, d.words, d.compact)));
      // bônus: a 1ª palavra buscada é o tipo do produto (abre o nome) —
      // "canta preta" põe as canetas antes do "caderno ... preto"
      const headHit = docs.map((d) => tokenScore(tokens[0], [d.head], d.head) > 0);
      const rank = (i: number) => scores[i].reduce((a, b) => a + b, 0) + (headHit[i] ? 3 : 0);
      const order = (ids: number[]) =>
        ids.sort((a, b) => rank(b) - rank(a) || docs[a].name.localeCompare(docs[b].name, 'pt-BR'));

      const all = docs.map((_, i) => i);
      const strict = all.filter((i) => scores[i].every((s) => s > 0));
      const result = order(strict);
      if (tokens.length < 2 || opts?.strict) return result.map((i) => docs[i].item);

      // Sobra: o tipo do produto ("caderno") pode não estar no nome
      // ("BATMAN FORONI 10x1"). Se achou pouco e o resto da busca é bem
      // específico ("batman"), mostra esses também, depois dos exatos.
      // "Tipo" = palavra que abre o nome de vários produtos; cor/marca não é.
      if (strict.length >= MAX_STRICT_FOR_EXTRA) return result.map((i) => docs[i].item);
      const typeCount = tokens.map((t) => docs.filter((d) => d.head === t.stem).length);
      const drop = typeCount.indexOf(Math.max(...typeCount));
      if (typeCount[drop] < 2) return result.map((i) => docs[i].item);
      const kept = all.filter((i) => scores[i].every((s, k) => k === drop || s > 0));
      if (kept.length > MAX_EXTRA) return result.map((i) => docs[i].item);
      const strictSet = new Set(strict);
      result.push(...order(kept.filter((i) => !strictSet.has(i))));
      return result.map((i) => docs[i].item);
    },
  };
}

/** Atalho para buscar uma vez (sem guardar o índice). */
export function smartSearch<T>(
  items: T[],
  query: string,
  fields: (item: T) => Array<string | null | undefined>,
  opts?: { strict?: boolean },
): T[] {
  return buildSearchIndex(items, fields).search(query, opts);
}

/** Campos pesquisáveis padrão de um produto. */
export function productSearchFields(p: {
  name: string;
  sku?: string | null;
  barcode?: string | null;
  category?: { name?: string | null } | null;
  categoryName?: string | null;
  supplier?: { name?: string | null } | null;
}): Array<string | null | undefined> {
  return [p.name, p.sku, p.barcode, p.category?.name ?? p.categoryName, p.supplier?.name];
}

// ---------- "Você quis dizer…?" ----------

/** Palavra do catálogo: quantas vezes aparece e a grafia mais usada (com acento). */
export type Vocabulary = Map<string, { count: number; display: string }>;

/** Vocabulário dos nomes dos produtos (palavras com letras, 3+ caracteres). */
export function buildVocabulary(names: string[]): Vocabulary {
  const spellings = new Map<string, Map<string, number>>();
  for (const name of names) {
    for (const raw of name.split(/[^\p{L}\p{N}]+/u)) {
      const key = normalizeText(raw);
      if (key.length < 3 || !/[a-z]/.test(key) || /\d/.test(key)) continue;
      const forms = spellings.get(key) ?? new Map<string, number>();
      const shown = raw.toLowerCase();
      forms.set(shown, (forms.get(shown) ?? 0) + 1);
      spellings.set(key, forms);
    }
  }
  const vocab: Vocabulary = new Map();
  for (const [key, forms] of spellings) {
    let display = key;
    let best = 0;
    let count = 0;
    for (const [form, n] of forms) {
      count += n;
      // prefere a grafia mais comum; empate → a acentuada ("esferográfica")
      if (n > best || (n === best && form !== key)) [display, best] = [form, n];
    }
    vocab.set(key, { count, display });
  }
  return vocab;
}

/** Palavra do catálogo mais parecida (null se nenhuma for parecida o bastante). */
export function closestWord(word: string, vocab: Vocabulary): string | null {
  const max = Math.min(3, Math.max(1, Math.floor(word.length * 0.4)));
  let best: string | null = null;
  let bestD = max + 1;
  let bestCount = 0;
  for (const [key, { count }] of vocab) {
    const d = editDistance(word, key, max);
    // mesma distância: fica com a palavra mais comum (a grafia "certa")
    if (d < bestD || (d === bestD && count > bestCount)) [best, bestD, bestCount] = [key, d, count];
  }
  return bestD <= max ? best : null;
}

/**
 * Corrige a busca palavra por palavra ("cdrno btmn" → "caderno batman").
 * Devolve null quando não há o que sugerir.
 */
export function suggestQuery(query: string, vocab: Vocabulary): string | null {
  const words = tokenize(query);
  if (!words.length) return null;
  let changed = false;
  const fixed = words.map((w) => {
    if (w.length < 3 || /\d/.test(w) || STOP_WORDS.has(w)) return w;
    if (vocab.has(w) || [...vocab.keys()].some((k) => k.startsWith(w))) return vocab.get(w)?.display ?? w;
    const near = closestWord(w, vocab);
    if (!near) return w;
    changed = true;
    return vocab.get(near)?.display ?? near;
  });
  return changed ? fixed.join(' ') : null;
}

/** Sugestão que de fato acha algo neste catálogo (null se não houver). */
export function suggestFor<T>(items: T[], query: string, fields: (item: T) => Array<string | null | undefined>): string | null {
  const suggestion = suggestQuery(query, buildVocabulary(items.map((i) => fields(i)[0] ?? '')));
  return suggestion && smartSearch(items, suggestion, fields).length ? suggestion : null;
}
