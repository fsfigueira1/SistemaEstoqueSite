# Fase 2: Robô do WhatsApp (orçamento automático) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Atualizado em 21/10/2026** com `docs/integracao-site-whatsapp.md` (escrito pelo chat do site). Mudou: o site já está publicado na Vercel; os testes do site são `node --test` (não vitest); o botão do site manda o pedido inteiro no formato `#ORC-SITE v1` com SKU, e o robô orça esse formato primeiro.

**Goal:** Quando um cliente escreve para o WhatsApp da loja, o robô responde sozinho:
- pedido vindo do site (`#ORC-SITE v1`) → orçamento por SKU;
- mensagem com código `#L-XXXX` → orçamento da lista salva;
- lista em texto ou foto → orçamento montado pelo estoque;
- SIM/SAIR → entra ou sai das novidades;
- qualquer outra coisa → endereço, horário e aviso de que um atendente vai responder.

O contato é gravado na hora.

**Architecture:** O webhook mora no **LacolariaSite** (Next.js 16, hospedado na Vercel no futuro), em `app/api/whatsapp/webhook/route.ts`. Ele valida a assinatura da Meta, responde 200 na hora e processa depois com `after()` de `next/server`. A lógica do robô é pura (`lib/whatsapp/bot.ts`) e recebe as dependências por parâmetro (banco, envio, leitura de foto), então é testada sem rede e sem banco. O acesso ao banco é SQL simples com `pg` no mesmo Postgres do sistema. As tabelas novas (`Contact`, `WhatsAppMessage`) são criadas pelo **sistema** (schema + migração + `schemaUpgrade.ts`), que continua dono do schema. As regras de orçamento são **copiadas** do sistema (`schoolList.ts`, `savedLists.ts`), com cabeçalho de sincronia.

**Tech Stack:** Next.js 16 (Route Handler + `after`), `pg`, `node --test` (padrão atual do site: `npm test`, imports com extensão `.ts`), WhatsApp Cloud API (Graph API), API do Claude (leitura de foto, chave em `Settings.aiApiKey`).

**Spec:** `docs/superpowers/specs/2026-10-20-whatsapp-orcamento-novidades-design.md` (§3, §4, §5, §6, §7.2, §8 item 2)

## Global Constraints

- **Nada é publicado por este trabalho.** Não rodar `electron:publish`/`release` (a loja continua na versão de teste do sistema). O site já está na Vercel (https://lacolaria.vercel.app), mas `vercel deploy` só a pedido da dona: o webhook fica testável localmente até lá.
- **Não quebrar o `npm test` do site** (58 testes em `node --test`). Testes novos no mesmo padrão: `node:test` + `node:assert/strict`, arquivos `lib/**/*.test.ts`.
- **Outra sessão também mexe no site** (vitrine, chat). Só criar/editar os arquivos listados nas tasks; não tocar em `lib/orcamento/**`, `content/**`, `app/api/chat/**`.
- **Nunca usar o `DATABASE_URL` do `.env` do sistema** (é o Supabase de produção). Testes de banco usam Postgres temporário local (pglite em `127.0.0.1:54329`).
- Credenciais da Meta e do banco **só em variáveis de ambiente** do site (`.env.local`, que o git ignora): `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_GRAPH_VERSION` (padrão `v23.0`), `DATABASE_URL`. Nada disso vai para o repositório. Criar um `.env.example` só com os nomes.
- Toda mensagem do robô em pt-BR, curta e com o tom do site. Endereço, horário e nome vêm de `content/site.ts`, nunca digitados à mão.
- O orçamento **nunca** usa preço gravado: sempre `Product.salePrice`/`stockQuantity` do momento. Lista desativada não responde (`activeOnly`).
- Todo orçamento termina com: retirada na loja, "valores e disponibilidade conferidos agora, sujeitos a alteração na retirada" e endereço.
- Webhook: GET valida `hub.verify_token`. POST sem assinatura `X-Hub-Signature-256` válida (HMAC SHA-256 do corpo cru com `WHATSAPP_APP_SECRET`, comparação em tempo constante) → 401. Evento repetido (mesmo `id` da Meta) não é processado duas vezes.
- Pausa humana: mensagem enviada pela loja no app do celular (evento de eco da coexistência) pausa o robô **naquela conversa por 6 horas**.
- Pergunta de novidades: feita **uma vez por contato**, no fim da primeira resposta. Só recebe novidades quem responder SIM. SAIR desliga para sempre (até mandar SIM de novo).
- Banco no site: pool `pg` com `max: 1` (serverless + Supabase free com ~15 conexões).

## Review Focus

- **Pedido do site editado pelo cliente antes de enviar** (linha apagada, quantidade trocada, texto a mais): o robô orça o que dá e ignora linhas que não casam com a regra, sem quebrar. Teste na Task 4: `pedido do site editado ainda orça`.

- **Mensagem com código de lista desativada ou inexistente**: o robô não deve ficar mudo nem quebrar. Responde que não encontrou a lista e pede a lista em texto ou foto. Teste na Task 4: `código desconhecido pede a lista`.
- **"sim", "Sim!", " SAIR " (caixa, pontuação, espaços)**: o cliente espera que funcione. Teste na Task 4: `SIM e SAIR aceitam variações`.
- **Mensagem que não é lista** ("que horas abre?", "tem mochila?") não deve virar um orçamento falso de 1 item. Teste na Task 4: `pergunta comum não vira orçamento`.
- **Mesma mensagem entregue duas vezes pela Meta** (reenvio): não pode responder duas vezes. Teste na Task 4: `mensagem repetida é ignorada`.
- **Foto sem chave do Claude configurada**: pedir a lista em texto, sem erro. Teste na Task 4: `foto sem IA pede texto`.

---

### Task 1: Tabelas de contato e mensagens (repositório do sistema)

**Files (SistemaEstoqueSite):**
- Modify: `prisma/schema.prisma` (models `Contact`, `WhatsAppMessage`; relação opcional `Contact.customerId → Customer`)
- Create: `prisma/migrations/20261021120000_whatsapp_contacts/migration.sql`
- Modify: `src/lib/schemaUpgrade.ts` (bloco `// --- 0.4.0: contatos do WhatsApp ---`; atualizar o comentário de sincronia)
- Modify: `tests/utils.ts` (`cleanupDatabase` apaga `whatsAppMessage` e `contact` antes de `customer`)

**Interfaces:**
- Produces (nomes de tabela/coluna usados pelo SQL do site na Task 5):

```prisma
model Contact {
  id             String            @id @default(uuid())
  phone          String            @unique   // só dígitos, com DDI: "5517999998888"
  name           String?
  source         String            @default("whatsapp") // whatsapp | cliente | planilha
  optInAt        DateTime?
  optOutAt       DateTime?
  optInAskedAt   DateTime?
  botPausedUntil DateTime?
  customerId     String?
  createdAt      DateTime          @default(now())
  updatedAt      DateTime          @updatedAt
  customer       Customer?         @relation(fields: [customerId], references: [id], onDelete: SetNull)
  messages       WhatsAppMessage[]
}

model WhatsAppMessage {
  id        String   @id @default(uuid())
  metaId    String?  @unique
  contactId String
  direction String   // in | out
  type      String   // text | image | template | other
  body      String   @default("")
  status    String   @default("received") // received | sent | delivered | read | failed
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  contact   Contact  @relation(fields: [contactId], references: [id], onDelete: Cascade)
  @@index([contactId, createdAt])
}
```

- [ ] **Step 1: Schema + migração + schemaUpgrade.** Mesmo procedimento da fase 1: `prisma migrate diff --from-schema <schema anterior> --to-schema prisma/schema.prisma --script`, converter para `IF NOT EXISTS` com FKs dentro do `CREATE TABLE` e copiar para `SCHEMA_UPGRADE_STATEMENTS`. Rodar `npx prisma generate`.
- [ ] **Step 2: Verificar.** Subir o pglite e rodar `DATABASE_URL=<pglite> npx prisma migrate deploy` → `All migrations have been successfully applied.` Depois `npx tsc --noEmit` sem erros e `npx vitest run src/lib tests/savedListService.test.ts` verde (pglite novo).
- [ ] **Step 3: Commit** `WhatsApp: tabelas Contact e WhatsAppMessage`.

---

### Task 2: Preparar o site (git, testes, regras de orçamento copiadas)

**Files (LacolariaSite):**
- Run: `git init` e um primeiro commit com o site como está, antes de qualquer mudança. O `.gitignore` já existe: conferir que cobre `.env*.local`, `.next`, `node_modules` e `.playwright-mcp`.
- Modify: `package.json` (deps `pg`; devDeps `@types/pg`). O script `test` continua o mesmo (`node --test`).
- Create: `lib/quote/schoolList.ts`, `lib/quote/savedLists.ts`: cópias de `SistemaEstoqueSite/src/lib/schoolList.ts` e `src/lib/savedLists.ts`, com a primeira linha `// CÓPIA de SistemaEstoqueSite/src/lib/<arquivo> — mantenha em sincronia (fase 2 do WhatsApp).` e o import trocado para `./schoolList.ts` (o `node --test` não entende o alias `@`).
- Create: `lib/quote/schoolList.test.ts`, `lib/quote/savedLists.test.ts`: os testes do sistema convertidos de vitest para `node:test` + `node:assert/strict`, com os mesmos casos e valores.
- Create: `.env.example` (só os nomes das variáveis de Global Constraints)

**Interfaces:**
- Produces: `parseList`, `buildQuote`, `quoteMessage`, `allocate`, `quoteTotals`, `CatalogProduct`, `QuoteLine` (de `lib/quote/schoolList`) e `savedLines`, `SavedQuoteLine`, `SavedItemInput` (de `lib/quote/savedLists`)

- [ ] **Step 1:** `git init` + commit inicial `Site como estava antes do WhatsApp`.
- [ ] **Step 2:** Instalar `pg` e `@types/pg`.
- [ ] **Step 3:** Copiar libs e converter os testes. Rodar `npm test` → PASS: os 58 testes que já existiam mais os copiados (mesma contagem de casos dos originais).
- [ ] **Step 4:** `npx tsc --noEmit` e `npx next build` → sem erros (o build não pode exigir `DATABASE_URL`).
- [ ] **Step 5: Commit** `WhatsApp: regras de orçamento copiadas do sistema`.

---

### Task 3: Ler o webhook da Meta (assinatura e eventos)

**Files (LacolariaSite):**
- Create: `lib/whatsapp/webhook.ts`
- Test: `lib/whatsapp/webhook.test.ts`

**Interfaces:**
- Produces:
  - `verifySignature(rawBody: string, header: string | null, appSecret: string): boolean`
  - `type IncomingEvent =`
    `| { kind: "message"; metaId: string; from: string; name: string | null; type: "text" | "image" | "other"; text: string; imageId: string | null; timestamp: number }`
    `| { kind: "status"; metaId: string; status: "sent" | "delivered" | "read" | "failed" }`
    `| { kind: "echo"; to: string }`
  - `parseWebhook(payload: unknown): IncomingEvent[]`: ignora o que não reconhecer. Imagem: `text` = legenda (`caption`) ou `""`. Eco: campo `smb_message_echoes` (mensagens que a loja mandou pelo app), `to` = número do cliente.

- [ ] **Step 1: Write the failing tests**

```ts
it('assinatura válida e inválida', () => {
  const body = '{"a":1}'
  const sig = 'sha256=' + createHmac('sha256', 'segredo').update(body).digest('hex')
  expect(verifySignature(body, sig, 'segredo')).toBe(true)
  expect(verifySignature(body, sig, 'outro')).toBe(false)
  expect(verifySignature(body, null, 'segredo')).toBe(false)
  expect(verifySignature(body, 'sha256=zz', 'segredo')).toBe(false)
})
it('mensagem de texto', () => {
  const ev = parseWebhook(fixtureText) // entry[0].changes[0].value.messages[0] = { id:'wamid.1', from:'5517999998888', type:'text', text:{ body:'Oi' }, timestamp:'1700000000' }, contacts[0].profile.name='Ana'
  expect(ev).toEqual([{ kind:'message', metaId:'wamid.1', from:'5517999998888', name:'Ana', type:'text', text:'Oi', imageId:null, timestamp:1700000000 }])
})
it('imagem com legenda', () => {
  expect(parseWebhook(fixtureImage)[0]).toMatchObject({ type:'image', imageId:'MEDIA1', text:'lista do 3º ano' })
})
it('status e eco', () => {
  expect(parseWebhook(fixtureStatus)).toEqual([{ kind:'status', metaId:'wamid.9', status:'read' }])
  expect(parseWebhook(fixtureEcho)).toEqual([{ kind:'echo', to:'5517999998888' }])
})
it('payload estranho não quebra', () => {
  expect(parseWebhook(null)).toEqual([])
  expect(parseWebhook({ entry: [{ changes: [{ value: {} }] }] })).toEqual([])
})
```

(Fixtures no mesmo arquivo de teste, no formato da Cloud API: `{ object:'whatsapp_business_account', entry:[{ changes:[{ field:'messages', value:{ ... } }] }] }`. O eco vem com `field:'smb_message_echoes'` e `value.message_echoes[0].to`.)

- [ ] **Step 2:** `node --test lib/whatsapp/webhook.test.ts` → FAIL (módulo não existe)
- [ ] **Step 3:** Implementar com `crypto.createHmac` + `timingSafeEqual` (com tamanhos iguais checados antes).
- [ ] **Step 4:** rodar de novo → PASS
- [ ] **Step 5: Commit** `WhatsApp: leitura e assinatura do webhook`

---

### Task 4: O robô (decisão e textos, sem rede)

**Files (LacolariaSite):**
- Create: `lib/whatsapp/messages.ts` (textos)
- Create: `lib/whatsapp/bot.ts` (decisão)
- Test: `lib/whatsapp/bot.test.ts`

**Interfaces:**
- Consumes: Task 2 (`buildQuote`, `quoteMessage`, `parseList`, `CatalogProduct`, `SavedQuoteLine`) e Task 3 (`IncomingEvent`).
- Produces:
  - Em `lib/whatsapp/siteOrder.ts` (com teste `siteOrder.test.ts`), seguindo a gramática de `docs/integracao-site-whatsapp.md` §2:
    - `type ItemSite = { qtd: number; descricao: string; sku: string | null; secao: "material" | "uniforme" | null }`
    - `type GrupoSite = { titulo: string; itens: ItemSite[] }`
    - `parseOrcamentoSite(texto: string): { versao: 1; grupos: GrupoSite[] } | null`: `null` se a última linha não vazia (depois de `trim`, aceitando `\r\n`) não for exatamente `#ORC-SITE v1`. Item = `^- (\d+)x (.+?)(?: \[SKU ([^\]]+)\])?$`. `*…*` abre grupo; `Material escolar:`/`Uniforme:` definem `secao`; outras linhas são ignoradas.
  - `ORCAR_UNIFORME_DO_SITE = false` (constante em `bot.ts`): **decidido pela dona em 21/10: a loja confirma o uniforme na 1ª versão**; o botão do site continua mandando o pedido completo (não `#L-XXXX`). Com `false`, itens de `Uniforme` entram como "a loja confirma" (sem preço). Com `true`, orça igual material.
  - `extractListCode(text: string): string | null`: acha `#L-XXXX` ou `L-XXXX` em qualquer caixa → `"L-XXXX"` maiúsculo.
  - `looksLikeList(text: string): boolean`: `parseList(text).length >= 2 || /^\s*\d+\s+\S/m.test(text)`
  - `type ContactState = { id: string; isNew: boolean; optInAskedAt: Date | null; botPausedUntil: Date | null }`
  - `type BotPorts = {`
    `  recordIncoming(ev: Extract<IncomingEvent,{kind:"message"}>): Promise<ContactState | null>; // null = metaId já visto`
    `  savedQuote(code: string): Promise<{ title: string; lines: SavedQuoteLine[] } | null>; // activeOnly`
    `  catalog(): Promise<CatalogProduct[]>;`
    `  productsBySku(skus: string[]): Promise<Map<string, CatalogProduct>>; // só ACTIVE`
    `  readImage(imageId: string): Promise<string | null>; // null = sem chave de IA`
    `  setOptIn(contactId: string): Promise<void>;`
    `  setOptOut(contactId: string): Promise<void>;`
    `  markOptInAsked(contactId: string): Promise<void>;`
    `  pause(phone: string, until: Date): Promise<void>;`
    `  updateStatus(metaId: string, status: string): Promise<void>;`
    `  send(to: string, text: string, contactId: string): Promise<void>;`
    `  now(): Date }`
  - `handleEvent(ev: IncomingEvent, ports: BotPorts): Promise<void>`
  - Em `messages.ts`, puras e testadas pelo bot: `quoteReply(title: string, lines: Array<{qty:number; text:string; product: CatalogProduct | null}>): string` (usa `quoteMessage(site.name, title, lines, brl)` + rodapé), `notFoundListReply()`, `optInQuestion()`, `optInDone()`, `optOutDone()`, `handoffReply()` (endereço + horário de `site`), `photoNeedsTextReply()`, `readingPhotoReply()`.

Ordem da decisão em `handleEvent` para `kind:"message"`:
1. `recordIncoming` → `null` = repetida → para.
2. `botPausedUntil > now` → para (atendente está na conversa).
3. Texto normalizado (sem acento/pontuação, minúsculo, trim) igual a `sim` → `setOptIn` + `optInDone`. Igual a `sair`/`parar`/`cancelar` → `setOptOut` + `optOutDone`. Fim.
4. `parseOrcamentoSite(text)` ≠ null → `productsBySku`. Linhas na ordem da mensagem, **somando a quantidade do mesmo SKU** entre grupos. Item sem SKU, SKU desconhecido ou inativo → `product: null` ("a loja confirma"). Uniforme com `ORCAR_UNIFORME_DO_SITE = false` → `product: null`. Resposta `quoteReply("pedido do site", linhas)`. Este passo vem **antes** do `#L-`, porque o pedido do site tem cara de lista.
5. `extractListCode(text)` → `savedQuote(code)`. Achou → `quoteReply(title, lines)`. Não achou → `notFoundListReply()`.
6. `type:"image"` → `readImage`. `null` → `photoNeedsTextReply()`. Texto lido → orçamento com `buildQuote(lido, catalog())`.
7. `looksLikeList(text)` → `buildQuote(text, catalog())`, linhas com `product` = o candidato escolhido (`productId`) → `quoteReply("sua lista", ...)`.
8. Senão → `handoffReply()`.
9. Se `optInAskedAt == null` (e não foi SIM/SAIR): acrescenta `optInQuestion()` na mesma resposta e chama `markOptInAsked`.

`kind:"echo"` → `pause(to, now + 6h)`. `kind:"status"` → `updateStatus`.

- [ ] **Step 1: Write the failing tests** (`node:test` + `assert`; abaixo as asserções em estilo `expect` só para ler — escrever com `assert.equal`/`assert.match`/`assert.deepEqual`). Fixture `PEDIDO_SITE` = exemplo real de `docs/integracao-site-whatsapp.md` §2.

`siteOrder.test.ts`:
- `parseOrcamentoSite` lê 2 grupos e 6 itens; "Tinta guache 6 cores" tem `sku: null`; "Camiseta manga cobalto, tamanho 2" tem `secao: "uniforme"`, `sku: "2000000000022"`, `qtd: 1`.
- texto sem a marca final → `null`; marca `#ORC-SITE v2` → `null`.
- mesmo texto com `\r\n` e `"  \n"` depois da marca → aceito.
- linha `- abc` que não casa é ignorada, sem erro.

`bot.test.ts` (com `fakePorts()` em memória que grava os `send`):

```ts
it('pedido do site orça por SKU e não cai em lista livre', async () => {
  const p = fakePorts({ bySku: { '7891027116804': caderno, '7908673911759': lapis } })
  await handleEvent(msg(PEDIDO_SITE), p)
  expect(p.sent[0]).toContain('Caderno'); expect(p.catalogCalls).toBe(0)
  expect(p.sent[0]).toMatch(/Tinta guache/)              // vai para "a loja confirma"
})
it('SKU repetido em dois grupos soma', async () => {
  // dois grupos com "- 2x Lápis [SKU 7908673911759]" e "- 3x Lápis [SKU 7908673911759]"
  expect(p.sent[0]).toContain('5 × Lápis')
})
it('uniforme do site fica para a loja confirmar (ORCAR_UNIFORME_DO_SITE=false)', async () => {
  expect(p.sent[0]).not.toMatch(/Camiseta.*R\$/)
})
it('pedido do site editado ainda orça', async () => {
  // PEDIDO_SITE sem uma linha de item e com "obs: urgente" no meio
  expect(p.sent[0]).toContain('Total: R$')
})
```

```ts
it('código de lista salva responde orçamento com rodapé', async () => {
  const p = fakePorts({ saved: { 'L-3A7K': { title: 'Colégio X — 3º ano', lines: [{ raw:'2 lápis', text:'lápis', qty:2, product: lapis, savedProductId: lapis.id }] } } })
  await handleEvent(msg('Olá! Quero o orçamento da lista #L-3a7k'), p)
  expect(p.sent[0]).toContain('Colégio X — 3º ano')
  expect(p.sent[0]).toContain('Total: R$')
  expect(p.sent[0]).toContain('retirada')
})
it('código desconhecido pede a lista', async () => {
  const p = fakePorts({})
  await handleEvent(msg('#L-ZZZZ'), p)
  expect(p.sent[0]).toBe(notFoundListReply() + '\n\n' + optInQuestion())
})
it('SIM e SAIR aceitam variações', async () => {
  const p = fakePorts({})
  await handleEvent(msg(' Sim! '), p); expect(p.optIn).toEqual(['c1'])
  await handleEvent(msg('SAIR', 'wamid.2'), p); expect(p.optOut).toEqual(['c1'])
})
it('pergunta comum não vira orçamento', async () => {
  const p = fakePorts({})
  await handleEvent(msg('que horas vocês abrem?'), p)
  expect(p.sent[0]).toContain(handoffReply())
})
it('lista em texto vira orçamento pelo catálogo', async () => {
  const p = fakePorts({ catalog: [lapis, borracha] })
  await handleEvent(msg('2 lápis\n1 borracha'), p)
  expect(p.sent[0]).toMatch(/Lápis.*\n.*Borracha/s)
})
it('mensagem repetida é ignorada', async () => {
  const p = fakePorts({})
  await handleEvent(msg('oi', 'wamid.1'), p); await handleEvent(msg('oi', 'wamid.1'), p)
  expect(p.sent).toHaveLength(1)
})
it('foto sem IA pede texto', async () => {
  const p = fakePorts({ readImage: null })
  await handleEvent(img('MEDIA1'), p)
  expect(p.sent[0]).toContain(photoNeedsTextReply())
})
it('conversa pausada por atendente não responde', async () => {
  const p = fakePorts({})
  await handleEvent({ kind:'echo', to:'5517999998888' }, p)
  await handleEvent(msg('oi', 'wamid.3'), p)
  expect(p.sent).toHaveLength(0)
})
it('pergunta de novidades só uma vez', async () => {
  const p = fakePorts({})
  await handleEvent(msg('oi', 'wamid.4'), p); await handleEvent(msg('oi de novo', 'wamid.5'), p)
  expect(p.sent.filter((s) => s.includes(optInQuestion()))).toHaveLength(1)
})
```

- [ ] **Step 2:** `node --test lib/whatsapp/siteOrder.test.ts lib/whatsapp/bot.test.ts` → FAIL
- [ ] **Step 3:** Implementar `messages.ts` e `bot.ts`. Usar `Intl.NumberFormat('pt-BR', { style:'currency', currency:'BRL' })` para o `brl`. Se `readImage` lançar erro, responder `photoNeedsTextReply()`. Erros de `send` sobem (a rota registra).
- [ ] **Step 4:** rodar de novo → PASS (13 testes do bot + os do siteOrder)
- [ ] **Step 5: Commit** `WhatsApp: robô de orçamento (lógica e textos)`

---

### Task 5: Ligar o robô ao banco, à Meta e ao Claude

**Files (LacolariaSite):**
- Create: `lib/db.ts`: `getPool(): Pool`, preguiçoso, `max: 1`, `DATABASE_URL` obrigatório só na primeira consulta.
- Create: `lib/whatsapp/ports.ts`: `createPorts(): BotPorts` com SQL nas tabelas da Task 1 e da fase 1.
- Create: `lib/whatsapp/graph.ts`: `sendText(to, text, fetchImpl = fetch): Promise<string>` (devolve o `wamid`) e `downloadMedia(mediaId, fetchImpl = fetch): Promise<{ mime: string; base64: string }>`
- Create: `lib/whatsapp/readImage.ts`: `readListImage(media, apiKey, model, fetchImpl = fetch): Promise<string>` (mesmo prompt de `SistemaEstoqueSite/src/services/schoolListService.ts`)
- Test: `lib/whatsapp/graph.test.ts`, `lib/whatsapp/ports.test.ts` (este pulado sem `DATABASE_URL` local)

**Interfaces:**
- Consumes: `BotPorts` (Task 4), tabelas `Contact`/`WhatsAppMessage` (Task 1) e `School`/`SchoolList`/`SchoolListItem`/`Product`/`Settings` (fase 1 e sistema).
- Produces: `createPorts(): BotPorts`

SQL que precisa existir:
- `recordIncoming`: upsert do `Contact` por `phone` (`xmax = 0` indica criado) e `INSERT INTO "WhatsAppMessage" ... ON CONFLICT ("metaId") DO NOTHING RETURNING id`. Sem linha devolvida → `null`.
- `savedQuote`: lista por `code` com `active = true`, itens ordenados por `position`, `LEFT JOIN "Product"` só com `status = 'ACTIVE'`. Montar com `savedLines`. Título `"<escola> — <série>"`.
- `catalog`: produtos `ACTIVE` (mesmos campos de `CATALOG_SELECT`).
- `readImage`: `Settings.aiApiKey`/`aiModel` (primeira linha). Chave vazia → `null`.
- `send`: `sendText` + `INSERT` da mensagem `out` com o `metaId` devolvido.

- [ ] **Step 1: Write the failing tests** (`graph.test.ts` com `fetch` falso)

```ts
it('sendText chama a Graph API com o número e o texto', async () => {
  process.env.WHATSAPP_TOKEN = 't'; process.env.WHATSAPP_PHONE_NUMBER_ID = '123'
  const calls: any[] = []
  const f = async (url: string, init: any) => { calls.push({ url, init }); return new Response(JSON.stringify({ messages: [{ id: 'wamid.X' }] })) }
  expect(await sendText('5517999998888', 'Oi', f as any)).toBe('wamid.X')
  expect(calls[0].url).toBe('https://graph.facebook.com/v23.0/123/messages')
  expect(JSON.parse(calls[0].init.body)).toEqual({ messaging_product: 'whatsapp', to: '5517999998888', type: 'text', text: { body: 'Oi', preview_url: false } })
  expect(calls[0].init.headers.Authorization).toBe('Bearer t')
})
it('sendText com erro da Meta lança mensagem clara', async () => {
  const f = async () => new Response(JSON.stringify({ error: { message: 'bad' } }), { status: 400 })
  await expect(sendText('1', 'x', f as any)).rejects.toThrow('WhatsApp HTTP 400: bad')
})
```

`ports.test.ts` (só roda se `DATABASE_URL` for `127.0.0.1`): `recordIncoming` devolve `isNew: true` e depois `null` para o mesmo `metaId`; `savedQuote` de uma lista criada direto no banco devolve título e linhas; lista desativada → `null`.

- [ ] **Step 2:** rodar → FAIL
- [ ] **Step 3:** Implementar. A Graph usa `WHATSAPP_GRAPH_VERSION ?? 'v23.0'`. `downloadMedia`: GET `/{mediaId}` → `url` → GET com o token.
- [ ] **Step 4:** `node --test "lib/whatsapp/*.test.ts"` → PASS. Com o pglite (migrações do sistema aplicadas): `DATABASE_URL=<pglite> node --test lib/whatsapp/ports.test.ts` → PASS.
- [ ] **Step 5: Commit** `WhatsApp: banco, envio pela Meta e leitura de foto`

---

### Task 6: Rota do webhook + guia de configuração

**Files (LacolariaSite):**
- Create: `lib/whatsapp/handler.ts` (lógica da rota, testável sem o Next)
- Test: `lib/whatsapp/handler.test.ts`
- Create: `app/api/whatsapp/webhook/route.ts` (fino: só chama o handler com `after` e `createPorts`)
- Create: `docs/whatsapp-setup.md`

**Interfaces:**
- Consumes: `verifySignature`, `parseWebhook` (Task 3), `handleEvent` (Task 4), `createPorts` (Task 5)
- Produces:
  - `verifyGet(url: URL, verifyToken: string | undefined): Response`
  - `handlePost(raw: string, signature: string | null, deps: { appSecret: string | undefined; schedule: (job: () => Promise<void>) => void; handle: (ev: IncomingEvent) => Promise<void> }): Response`
  - na rota: `GET`, `POST`, `export const runtime = "nodejs"`, `export const maxDuration = 60`; `POST` = `handlePost(await request.text(), request.headers.get('x-hub-signature-256'), { appSecret: env, schedule: after, handle: (ev) => handleEvent(ev, createPorts()) })`

Comportamento:
- `GET`: `hub.mode=subscribe` + `hub.verify_token` igual ao env → devolve `hub.challenge` (texto, 200). Senão 403.
- `POST`: lê o corpo cru (`await request.text()`). Assinatura inválida → 401. Válida → `parseWebhook(JSON.parse(raw))` → `after(async () => { for (const ev of events) await handleEvent(ev, createPorts()) })` com `try/catch` por evento (`console.error` com o `metaId`) → responde 200 na hora.

- [ ] **Step 1: Write the failing tests** em `lib/whatsapp/handler.test.ts` (`node:test`; `schedule` = roda o job na hora; `handle` = grava em `handled`). As chamadas abaixo usam `GET(...)`/`POST(...)` como apelido de `verifyGet(new URL(...), token)`/`handlePost(body, sig, deps)`.

```ts
it('GET devolve o challenge com o token certo', async () => {
  process.env.WHATSAPP_VERIFY_TOKEN = 'v'
  const r = GET(new Request('http://x/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=v&hub.challenge=42'))
  expect(r.status).toBe(200); expect(await r.text()).toBe('42')
})
it('GET com token errado é 403', () => {
  expect(GET(new Request('http://x/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=no&hub.challenge=1')).status).toBe(403)
})
it('POST sem assinatura é 401 e não processa', async () => {
  const r = await POST(new Request('http://x', { method: 'POST', body: '{}' }))
  expect(r.status).toBe(401); expect(handled).toHaveLength(0)
})
it('POST assinado responde 200 e processa a mensagem', async () => {
  process.env.WHATSAPP_APP_SECRET = 's'
  const body = JSON.stringify(fixtureText)
  const sig = 'sha256=' + createHmac('sha256', 's').update(body).digest('hex')
  const r = await POST(new Request('http://x', { method: 'POST', body, headers: { 'x-hub-signature-256': sig } }))
  expect(r.status).toBe(200); expect(handled).toHaveLength(1)
})
```

- [ ] **Step 2:** rodar → FAIL
- [ ] **Step 3:** Implementar a rota. Escrever o `docs/whatsapp-setup.md` em pt-BR para a dona:
  1. No Meta for Developers, criar o app e adicionar o WhatsApp.
  2. Usar primeiro o **número de teste** da Meta.
  3. Gerar o token permanente (System User).
  4. Copiar Phone Number ID, App Secret e Verify Token para o `.env.local`.
  5. Expor o `localhost` com um túnel para testar o webhook sem publicar o site.
  6. Assinar os campos `messages` e `smb_message_echoes`.
  7. Só no fim, migrar o número da loja em modo coexistência.
- [ ] **Step 4:** `npm test` → tudo PASS (os 58 antigos + os novos). `npx tsc --noEmit` e `npx next build` → sem erros.
- [ ] **Step 5: Commit** `WhatsApp: rota do webhook e guia de configuração`

---

## Próximos planos

- Fase 3: tela Novidades no sistema, importação do Excel, envio em lotes por template (cron no site) e status.
- Fase 4: escolas/uniformes no sistema + vitrine `/listas` no site com o botão `#L-XXXX`.
