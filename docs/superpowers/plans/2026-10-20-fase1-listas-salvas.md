# Fase 1: Listas escolares salvas (escola + série) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Na tela Lista Escolar, a loja salva a lista conferida como "Escola – Série – Ano letivo". Depois abre a lista salva com preço e estoque recalculados na hora e gerencia as listas salvas (ver código, desativar, excluir).

**Architecture:** Três tabelas novas (`School`, `SchoolList`, `SchoolListItem`) criadas pelo schema Prisma, por uma migração SQL e pelo `schemaUpgrade.ts` em runtime (padrão do projeto). Regras puras em `src/lib/savedLists.ts`, acesso ao banco em `src/services/savedListService.ts`, rotas em `src/app/api/school-lists/**` e UI na página existente `src/app/lista-escolar` + página nova `src/app/lista-escolar/salvas`. O orçamento continua usando `allocate`/`quoteTotals`/`quoteMessage` de `src/lib/schoolList.ts`. Esta fase é a base das fases 2 (robô) e 4 (vitrine).

**Tech Stack:** Next.js 16 (App Router, `params` como Promise), Prisma 7 + Postgres, Vitest, Tailwind, lucide-react.

**Spec:** `docs/superpowers/specs/2026-10-20-whatsapp-orcamento-novidades-design.md` (§4, §6, §7.1 sem uniformes, §8 item 1)

## Global Constraints

- Todo texto de interface em português do Brasil.
- Schema novo entra em **três lugares e em sincronia**: `prisma/schema.prisma`, `prisma/migrations/20261020120000_school_lists/migration.sql` e `SCHEMA_UPGRADE_STATEMENTS` em `src/lib/schemaUpgrade.ts` (idempotente, `IF NOT EXISTS`). Todo service novo chama `await ensureSchema()` antes de consultar.
- POST/PATCH aceitam só `application/json`. Comparar o tipo principal antes do `;` e responder 415 `"Envie JSON"` (mesmo padrão de `src/app/api/catalog-review/route.ts`).
- Respostas de API: `{ success: true, data }` ou `{ success: false, error: friendlyError(error).message }`.
- Preço e estoque **nunca** ficam gravados na lista. Todo orçamento recalcula a partir de `Product` no momento da consulta.
- Produto inativo ou apagado vira item "não temos" (`product: null`), sem erro.
- Testes de banco só contra Postgres local (`tests/dbGuard.ts`).
- Código da lista: `L-` + 4 caracteres de `23456789ABCDEFGHJKMNPQRSTUVWXYZ` (sem 0/O/1/I/L), único.

## Review Focus

- **Salvar de novo a mesma escola + série + ano** deve substituir os itens da lista existente e manter o mesmo código, para não quebrar links já publicados. Teste na Task 2: `saveList twice keeps code and replaces items`.
- **Nome da escola com acento, maiúscula ou espaço diferente** ("Colégio São José" vs "colegio sao jose ") deve cair na mesma escola. Teste na Task 1 (`slugify`) e na Task 2 (`saveList reuses school by slug`).
- **Produto desativado depois de salvar a lista**: o orçamento mostra o item como "não temos" e não dá erro. Teste na Task 2: `getQuote treats inactive product as missing`.
- **Linhas marcadas "Fora" (skip) na tela** não entram na lista salva. Coberto na Task 4: `toSaveItems` filtra `skip` (teste puro na Task 1).
- **Lista desativada** continua visível no sistema, mas `getQuote` com `activeOnly` não a retorna (o robô e o site da fase 2 usam isso). Teste na Task 2: `getQuote activeOnly hides inactive list`.

---

### Task 1: Regras puras das listas salvas

**Files:**
- Create: `src/lib/savedLists.ts`
- Test: `src/lib/savedLists.test.ts`

**Interfaces:**
- Consumes: `CatalogProduct` de `src/lib/schoolList.ts`
- Produces:
  - `slugify(name: string): string`
  - `LIST_CODE_ALPHABET: string` = `"23456789ABCDEFGHJKMNPQRSTUVWXYZ"`
  - `newListCode(rand?: () => number): string` → `"L-XXXX"`
  - `normalizeGrade(grade: string): string` (trim + espaços colapsados; mantém o texto da loja, ex. "3º ano")
  - `type SavedItemInput = { raw: string; text: string; qty: number; productId: string | null }`
  - `toSaveItems(rows: Array<{ raw: string; text: string; qty: number; skip: boolean; product: { id: string } | null }>): SavedItemInput[]`
  - `type SavedQuoteLine = { raw: string; text: string; qty: number; product: CatalogProduct | null }`
  - `savedLines(items: SavedItemInput[], catalog: Map<string, CatalogProduct>): SavedQuoteLine[]`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect } from 'vitest'
import { slugify, newListCode, LIST_CODE_ALPHABET, normalizeGrade, toSaveItems, savedLines } from './savedLists'

describe('slugify', () => {
  it('remove acento, caixa e espaços extras', () => {
    expect(slugify('Colégio São José')).toBe('colegio-sao-jose')
    expect(slugify('  colegio   sao jose ')).toBe('colegio-sao-jose')
    expect(slugify('E.E. Prof. Ana (Unidade 2)')).toBe('e-e-prof-ana-unidade-2')
  })
})

describe('newListCode', () => {
  it('formato L- + 4 do alfabeto seguro', () => {
    for (let i = 0; i < 50; i++) expect(newListCode()).toMatch(/^L-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{4}$/)
  })
  it('determinístico com rand fixo', () => {
    expect(newListCode(() => 0)).toBe(`L-${LIST_CODE_ALPHABET[0].repeat(4)}`)
  })
})

describe('normalizeGrade', () => {
  it('colapsa espaços', () => expect(normalizeGrade('  3º   ano ')).toBe('3º ano'))
})

describe('toSaveItems', () => {
  it('ignora linhas fora e guarda só o id do produto', () => {
    const rows = [
      { raw: '2 lápis', text: 'lápis', qty: 2, skip: false, product: { id: 'p1' } },
      { raw: '1 régua', text: 'régua', qty: 1, skip: true, product: { id: 'p2' } },
      { raw: '1 compasso', text: 'compasso', qty: 1, skip: false, product: null },
    ]
    expect(toSaveItems(rows)).toEqual([
      { raw: '2 lápis', text: 'lápis', qty: 2, productId: 'p1' },
      { raw: '1 compasso', text: 'compasso', qty: 1, productId: null },
    ])
  })
})

describe('savedLines', () => {
  it('liga ao catálogo atual; produto ausente vira null', () => {
    const p1 = { id: 'p1', name: 'Lápis HB', barcode: null, sku: 'L1', salePrice: 2.5, stock: 10 }
    const lines = savedLines(
      [
        { raw: '2 lápis', text: 'lápis', qty: 2, productId: 'p1' },
        { raw: '1 cola', text: 'cola', qty: 1, productId: 'sumiu' },
        { raw: '1 compasso', text: 'compasso', qty: 1, productId: null },
      ],
      new Map([['p1', p1]]),
    )
    expect(lines.map((l) => l.product?.id ?? null)).toEqual(['p1', null, null])
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/savedLists.test.ts`
Expected: FAIL (`Cannot find module './savedLists'`)

- [ ] **Step 3: Implement `src/lib/savedLists.ts`**

Use `norm` de `src/lib/schoolList.ts` para tirar acento. `slugify` troca toda sequência de caractere que não seja `[a-z0-9]` por `-` e corta `-` das pontas. `newListCode` usa `rand` (padrão `Math.random`) para indexar o alfabeto. Cabeçalho de comentário em pt-BR no estilo dos outros `src/lib/*.ts` ("Regras puras (sem banco)…").

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/lib/savedLists.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/savedLists.ts src/lib/savedLists.test.ts
git commit -m "Listas salvas: regras puras (slug, código, itens)"
```

---

### Task 2: Tabelas + service de listas salvas

**Files:**
- Modify: `prisma/schema.prisma` (models novos no fim; relação reversa `schoolListItems SchoolListItem[]` em `Product`)
- Create: `prisma/migrations/20261020120000_school_lists/migration.sql`
- Modify: `src/lib/schemaUpgrade.ts` (bloco `// --- 0.4.0: listas escolares salvas ---`; atualizar o comentário "Mantenha em sincronia")
- Create: `src/services/savedListService.ts`
- Modify: `tests/utils.ts` (`cleanupDatabase`: apagar `schoolListItem`, `schoolList`, `school` **antes** de `product`)
- Test: `tests/savedListService.test.ts`

**Interfaces:**
- Consumes: Task 1 (`slugify`, `newListCode`, `normalizeGrade`, `SavedItemInput`, `savedLines`, `SavedQuoteLine`). Também `ensureSchema` de `src/lib/schemaUpgrade.ts` e o mapeamento de produto de `getCatalog` em `src/services/schoolListService.ts`: extrair `toCatalogProduct(row)` e reutilizar nos dois lugares em vez de duplicar.
- Produces (`SavedListService`):
  - `type SchoolDTO = { id: string; name: string; slug: string }`
  - `type SavedListSummary = { id: string; code: string; schoolId: string; schoolName: string; schoolSlug: string; grade: string; schoolYear: number; itemCount: number; active: boolean; updatedAt: string }`
  - `type SaveListInput = { schoolName: string; grade: string; schoolYear: number; sourceText: string; items: SavedItemInput[] }`
  - `listSchools(): Promise<SchoolDTO[]>` (ordem alfabética)
  - `saveList(input: SaveListInput): Promise<SavedListSummary>`
  - `listSaved(): Promise<SavedListSummary[]>` (ordem: escola, ano desc, série)
  - `getQuote(idOrCode: string, opts?: { activeOnly?: boolean }): Promise<{ list: SavedListSummary; lines: SavedQuoteLine[] } | null>`
  - `setActive(id: string, active: boolean): Promise<void>`
  - `remove(id: string): Promise<void>`

Schema (nomes exatos; SQL em migration e schemaUpgrade igual ao que `prisma migrate diff` gera):

```prisma
model School {
  id        String       @id @default(uuid())
  name      String
  slug      String       @unique
  active    Boolean      @default(true)
  createdAt DateTime     @default(now())
  updatedAt DateTime     @updatedAt
  lists     SchoolList[]
}

model SchoolList {
  id         String           @id @default(uuid())
  schoolId   String
  grade      String
  schoolYear Int
  code       String           @unique
  sourceText String           @default("")
  active     Boolean          @default(true)
  createdAt  DateTime         @default(now())
  updatedAt  DateTime         @updatedAt
  school     School           @relation(fields: [schoolId], references: [id], onDelete: Cascade)
  items      SchoolListItem[]
  @@unique([schoolId, grade, schoolYear])
}

model SchoolListItem {
  id        String     @id @default(uuid())
  listId    String
  position  Int
  raw       String
  text      String
  qty       Int
  productId String?
  list      SchoolList @relation(fields: [listId], references: [id], onDelete: Cascade)
  product   Product?   @relation(fields: [productId], references: [id], onDelete: SetNull)
  @@index([listId])
  @@index([productId])
}
```

- [ ] **Step 1: Schema, migração e schemaUpgrade**

Gerar o SQL: `npx prisma migrate diff --from-schema-datamodel <schema antigo> --to-schema-datamodel prisma/schema.prisma --script`. Colar na migração, depois converter cada `CREATE TABLE`/`CREATE INDEX` para `IF NOT EXISTS` e copiar para `SCHEMA_UPGRADE_STATEMENTS`. FKs ficam dentro do `CREATE TABLE` (como `ProductLabel`), para o `isAlreadyApplied` funcionar. Rodar `npx prisma generate`.

Verificação: `npx vitest run src/lib` passa e `npx tsc --noEmit -p tsconfig.json` sem erros novos.

- [ ] **Step 2: Write the failing tests** (`tests/savedListService.test.ts`, padrão de `tests/customerService.test.ts`: `cleanupDatabase()` no `beforeEach`, cria categoria + produtos via `prisma`)

```ts
it('saveList cria escola e lista com código', async () => {
  const s = await SavedListService.saveList({ schoolName: 'Colégio São José', grade: '3º ano', schoolYear: 2027, sourceText: 'x', items: [{ raw: '2 lápis', text: 'lápis', qty: 2, productId: pLapis.id }] })
  expect(s.schoolSlug).toBe('colegio-sao-jose')
  expect(s.code).toMatch(/^L-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{4}$/)
  expect(s.itemCount).toBe(1)
})

it('saveList reuses school by slug', async () => {
  await SavedListService.saveList({ ...base, schoolName: 'Colégio São José', grade: '3º ano' })
  await SavedListService.saveList({ ...base, schoolName: ' colegio sao jose ', grade: '4º ano' })
  expect(await SavedListService.listSchools()).toHaveLength(1)
})

it('saveList twice keeps code and replaces items', async () => {
  const a = await SavedListService.saveList({ ...base, items: [item1, item2] })
  const b = await SavedListService.saveList({ ...base, items: [item1] })
  expect(b.id).toBe(a.id)
  expect(b.code).toBe(a.code)
  expect(b.itemCount).toBe(1)
})

it('getQuote recalcula com preço atual', async () => {
  const s = await SavedListService.saveList({ ...base, items: [{ raw: '2 lápis', text: 'lápis', qty: 2, productId: pLapis.id }] })
  await prisma.product.update({ where: { id: pLapis.id }, data: { salePrice: 9.9 } })
  const q = await SavedListService.getQuote(s.code)
  expect(q!.lines[0].product!.salePrice).toBe(9.9)
})

it('getQuote treats inactive product as missing', async () => {
  const s = await SavedListService.saveList({ ...base, items: [{ raw: '2 lápis', text: 'lápis', qty: 2, productId: pLapis.id }] })
  await prisma.product.update({ where: { id: pLapis.id }, data: { status: 'INACTIVE' } })
  expect((await SavedListService.getQuote(s.id))!.lines[0].product).toBeNull()
})

it('getQuote activeOnly hides inactive list', async () => {
  const s = await SavedListService.saveList(base)
  await SavedListService.setActive(s.id, false)
  expect(await SavedListService.getQuote(s.code, { activeOnly: true })).toBeNull()
  expect(await SavedListService.getQuote(s.code)).not.toBeNull()
})

it('saveList rejeita série vazia, ano fora de 2000–2100 e lista sem itens', async () => {
  await expect(SavedListService.saveList({ ...base, grade: '  ' })).rejects.toThrow('Informe a série')
  await expect(SavedListService.saveList({ ...base, schoolYear: 1999 })).rejects.toThrow('Ano letivo inválido')
  await expect(SavedListService.saveList({ ...base, items: [] })).rejects.toThrow('A lista está vazia')
})
```

(`enum ProductStatus` = `ACTIVE | INACTIVE | DISCONTINUED`; só `ACTIVE` conta como "temos".)

- [ ] **Step 3: Run to verify it fails**

Run: `npx vitest run tests/savedListService.test.ts`
Expected: FAIL (`Cannot find module '../src/services/savedListService'`)

- [ ] **Step 4: Implement `src/services/savedListService.ts`**

`saveList` roda numa `prisma.$transaction`: upsert da escola por `slug` (atualiza `name` para a grafia mais recente) → acha a lista por `(schoolId, normalizeGrade(grade), schoolYear)` → se existir, `deleteMany` dos itens e update de `sourceText`/`active: true`. Se não existir, cria com `newListCode()`, e se der colisão no `code` (P2002 no campo `code`) tenta de novo até 5 vezes → `createMany` dos itens com `position` = índice. `getQuote` aceita id **ou** código: se casar `/^L-/i`, busca por `code` em maiúsculas. Monta o catálogo só com os `productId` da lista e `status: ACTIVE`, usando `toCatalogProduct`. Mensagens de erro exatamente como no teste.

- [ ] **Step 5: Run to verify it passes**

Run: `npx vitest run tests/savedListService.test.ts`
Expected: PASS (7 testes)

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20261020120000_school_lists src/lib/schemaUpgrade.ts src/services/savedListService.ts src/services/schoolListService.ts tests/utils.ts tests/savedListService.test.ts
git commit -m "Listas salvas: tabelas School/SchoolList e service"
```

---

### Task 3: Rotas de API

**Files:**
- Create: `src/app/api/school-lists/route.ts` (GET lista resumos; POST salva)
- Create: `src/app/api/school-lists/schools/route.ts` (GET escolas)
- Create: `src/app/api/school-lists/[id]/route.ts` (GET orçamento; PATCH `{ active: boolean }`; DELETE)
- Create: `src/lib/requireJson.ts` (helper do teste de content-type), mais `src/lib/requireJson.test.ts`

**Interfaces:**
- Consumes: `SavedListService` (Task 2)
- Produces (contratos HTTP usados pela UI da Task 4):
  - `GET /api/school-lists` → `{ success, data: SavedListSummary[] }`
  - `POST /api/school-lists` body `SaveListInput` → `{ success, data: SavedListSummary }` | 400 com a mensagem do service
  - `GET /api/school-lists/schools` → `{ success, data: SchoolDTO[] }`
  - `GET /api/school-lists/[id]` → `{ success, data: { list, lines } }` | 404 `"Lista não encontrada"`
  - `PATCH /api/school-lists/[id]` → `{ success: true }`; `DELETE` → `{ success: true }`
  - `isJsonRequest(request: Request): boolean`

- [ ] **Step 1: Write the failing test for `isJsonRequest`**

```ts
it('aceita só application/json pelo tipo principal', () => {
  const r = (ct: string) => new Request('http://x', { method: 'POST', headers: { 'content-type': ct } })
  expect(isJsonRequest(r('application/json; charset=utf-8'))).toBe(true)
  expect(isJsonRequest(r('text/plain; charset=application/json'))).toBe(false)
  expect(isJsonRequest(r('multipart/form-data'))).toBe(false)
})
```

- [ ] **Step 2: Run to verify it fails**: `npx vitest run src/lib/requireJson.test.ts` → FAIL

- [ ] **Step 3: Implement `isJsonRequest` e as três rotas**

`params` é `Promise<{ id: string }>` (padrão de `src/app/api/customers/[id]/route.ts`). POST/PATCH sem JSON → 415 `"Envie JSON"`. Erro de validação do service → 400. Nada encontrado → 404. Resto → 500.

- [ ] **Step 4: Run tests**: `npx vitest run src/lib/requireJson.test.ts` → PASS. Depois `npx tsc --noEmit` sem erros novos.

- [ ] **Step 5: Commit**

```bash
git add src/lib/requireJson.ts src/lib/requireJson.test.ts src/app/api/school-lists
git commit -m "Listas salvas: rotas de API"
```

---

### Task 4: Telas: salvar, abrir e gerenciar listas

**Files:**
- Create: `src/components/lista/SaveListDialog.tsx`
- Create: `src/components/lista/OpenSavedList.tsx`
- Modify: `src/app/lista-escolar/page.tsx`
- Create: `src/app/lista-escolar/salvas/page.tsx`
- Modify: navegação, onde "Lista escolar" aparece no menu (`src/components/Layout*`): sem item novo; a página de salvas tem link a partir da Lista Escolar.

**Interfaces:**
- Consumes: rotas da Task 3; `toSaveItems` (Task 1); `Row` de `src/components/lista/QuoteRow.tsx`; `SavedQuoteLine`.
- Produces: nada para outras tasks.

Comportamento:
- **Botão "Salvar como lista da escola"** no rodapé do orçamento (só aparece com `rows.length > 0`). Abre um diálogo (usar o componente de dialog já usado no app) com:
  - escola: input com `<datalist>` vindo de `/api/school-lists/schools`;
  - série: texto livre, placeholder "3º ano";
  - ano letivo: número, padrão = ano atual se o mês for até junho, senão ano seguinte.
  - Envia `{ schoolName, grade, schoolYear, sourceText: text, items: toSaveItems(rows) }`.
  - Sucesso: mostra "Lista salva — código L-XXXX" com botão copiar.
- **"Abrir lista salva"** ao lado da entrada da lista: select agrupado por escola com as listas de `/api/school-lists`. Ao escolher, `GET /api/school-lists/[id]` vira `rows`: `product` = a linha, `options` = `[product]` se existir, `skip: false`, `key` = `${i}-${text}`. O título vira `"<escola> — <série>"`. Não sobrescreve o rascunho de texto do localStorage.
- **Página `/lista-escolar/salvas`**: tabela com Escola, Série, Ano, Código (copiar), Itens, Atualizada, Ativa (switch → PATCH) e Excluir (confirmação → DELETE). Estado vazio: "Nenhuma lista salva ainda — monte um orçamento na Lista escolar e clique em Salvar." Usar `Layout` + `PageHeader` como as outras páginas.

- [ ] **Step 1: Implement os componentes e a página** seguindo `DESIGN.md` e o estilo da página atual (classes Tailwind de `src/app/lista-escolar/page.tsx`).

- [ ] **Step 2: Verificar tipos e lint**

Run: `npx tsc --noEmit && npx eslint src/app/lista-escolar src/components/lista`
Expected: sem erros novos.

- [ ] **Step 3: Verificar no app** (`npm run dev`, banco local):
  1. Colar "2 lápis\n1 borracha\n1 compasso", montar, marcar uma linha como Fora e salvar como "Colégio Teste / 3º ano / 2027". Aparece um código `L-XXXX`.
  2. Abrir a lista salva: aparecem 2 linhas (a de Fora não volta) com os preços atuais.
  3. Mudar o preço do lápis em Produtos e reabrir: o preço novo aparece.
  4. Salvar de novo com "colegio teste" / "3º ano" / 2027: o código continua o mesmo.
  5. Em `/lista-escolar/salvas`, desativar, reativar e excluir funcionam.

- [ ] **Step 4: Commit**

```bash
git add src/components/lista src/app/lista-escolar
git commit -m "Listas salvas: salvar, abrir e gerenciar na Lista escolar"
```

---

## Próximos planos (fora desta fase)

- Fase 2: webhook do WhatsApp + robô no `LacolariaSite` (usa `getQuote(code, { activeOnly: true })`, o mesmo SQL e `savedLines`).
- Fase 3: contatos, tela Novidades, importação do Excel, cron de envio.
- Fase 4: escolas/uniformes + vitrine.
