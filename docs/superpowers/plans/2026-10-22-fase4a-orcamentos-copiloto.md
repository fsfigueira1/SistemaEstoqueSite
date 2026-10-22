# Fase 4A: Orçamentos pedidos + copiloto (modo colar) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:**
- Uma tela **Atendimento** onde o atendente cola a mensagem do cliente (com nome e número) e recebe a resposta pronta: orçamento montado pelo estoque mais o texto da IA da NVIDIA. O orçamento fica salvo sozinho.
- Uma tela **Orçamentos pedidos** para achar o pedido quando a pessoa chega na loja e levar para o PDV.

**Architecture:**
- Regras puras de classificação copiadas do robô do site (`LacolariaSite/lib/whatsapp/siteOrder.ts` e as funções `extractListCode`/`looksLikeList`/`EXPLICIT_QTY` de `bot.ts`) para `src/lib/quoteIntent.ts`, com os testes.
- `src/services/quoteRequestService.ts` (tabela nova `QuoteRequest`).
- `src/services/copilotService.ts`: classifica, monta o orçamento no servidor, salva e pede à NVIDIA só a abertura ou a resposta de dúvida.
- Rotas em `src/app/api/{copilot,quote-requests}`. Telas `src/app/atendimento` e `src/app/orcamentos`.

**Tech Stack:** Next.js 16, Prisma 7 + Postgres, Vitest, NVIDIA (`src/lib/nvidia.ts`).

**Spec:** `docs/superpowers/specs/2026-10-22-fase4-atendimento-copiloto-design.md`

## Global Constraints

- Não publicar, não fazer deploy. Testes de banco e app só no Postgres local embutido (porta 54330). Nunca no `.env`.
- **Preço nunca passa pela IA:** o texto do orçamento é montado no servidor e concatenado. A IA recebe o orçamento só como contexto e devolve abertura curta (≤ 2 linhas).
- **O sistema nunca envia mensagem:** só "Copiar" e "Abrir no WhatsApp" (`wa.me`), em que o atendente aperta Enviar.
- Uniforme do pedido do site e item sem SKU → "a loja confirma" (decisão da dona). Lista livre: item não reconhecido → "a loja confirma".
- Telefone normalizado com `whatsappNumber`. Contato novo entra como pendente (`source "whatsapp"`, sem `optInAt`). Contato existente não muda.
- Esquema novo nos três lugares (schema, migração `20261022140000_quote_requests`, `schemaUpgrade.ts`).
- POST/PATCH só JSON (`isJsonRequest`). pt-BR. Telas no padrão `Layout` + `PageHeader`.

## Review Focus

- **Mensagem comum em duas linhas** ("Bom dia!\nQue horas abrem?") não vira orçamento nem é salva em Orçamentos. Teste na Task 3: `pergunta comum não salva orçamento`.
- **Sem chave da NVIDIA ou NVIDIA fora do ar:** o copiloto ainda devolve o orçamento com abertura fixa, e a dúvida comum recebe resposta fixa com horário e endereço. Teste na Task 3: `sem IA ainda responde`.
- **Telefone ausente ou inválido:** o orçamento é salvo mesmo assim (só com o nome) e não cria contato. Teste na Task 2: `salva sem telefone`.
- **Produto do orçamento que ficou inativo ou teve o preço mudado:** o detalhe mostra o preço de agora e o da época; levar ao PDV só leva o que está ativo e tem estoque. Teste na Task 2: `detalhe traz preço de agora`.
- **Mesmo cliente pedindo de novo:** cria outro orçamento (histórico), não sobrescreve. Teste na Task 2: `dois pedidos do mesmo telefone`.

---

### Task 1: Regras de classificação (cópia do robô)

**Files:** Create `src/lib/quoteIntent.ts`, `src/lib/quoteIntent.test.ts`

**Produces:**
- `parseOrcamentoSite`, `ItemSite`, `GrupoSite` (cópia de `LacolariaSite/lib/whatsapp/siteOrder.ts`, com a marca aceita em qualquer linha e o texto depois dela ignorado)
- `extractListCode(text): string | null`
- `looksLikeList(text): boolean`
- `EXPLICIT_QTY: RegExp`
- `type Intent = { kind: "site"; order } | { kind: "code"; code } | { kind: "list" } | { kind: "other" }`
- `classify(text: string): Intent` (ordem: site → código → lista → outra; código + texto com cara de lista = lista)

Cabeçalho `// CÓPIA de LacolariaSite/lib/whatsapp/{siteOrder,bot}.ts — mantenha em sincronia`.

- [ ] Testes portados do site (`siteOrder.test.ts` + `extractListCode/looksLikeList`) mais `classify` com os casos: pedido do site (com texto depois da marca), `#L-3A7K`, "2 lápis\n1 borracha", "Bom dia!\nQue horas abrem?", "2 lápis\n1 camiseta tam l-azul" → list. FAIL → implementar → PASS. **Commit** `Atendimento: regras de classificação de mensagem`.

### Task 2: Orçamentos pedidos (tabela + service)

**Files:**
- `prisma/schema.prisma`: `QuoteRequest`, mais `Settings.storeHours String @default("Segunda a sexta: 8h às 18h · Sábado: 8h às 13h")`
- migração `20261022140000_quote_requests`, `schemaUpgrade.ts`, `tests/utils.ts`
- `src/services/quoteRequestService.ts`, `tests/quoteRequestService.test.ts`

```prisma
model QuoteRequest {
  id        String   @id @default(uuid())
  name      String   @default("")
  phone     String?
  /// whatsapp | balcao
  source    String   @default("whatsapp")
  title     String   @default("")
  /// [{ qty, text, productId, price, take }] — price/take do momento do orçamento
  items     Json
  /// itens que a loja confirma (sem SKU, uniforme, não reconhecido)
  toConfirm Json     @default("[]")
  total     Decimal  @default(0)
  /// aberto | separado | retirado | cancelado
  status    String   @default("aberto")
  message   String   @default("")
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  @@index([phone])
  @@index([createdAt])
  @@index([status])
}
```

**Produces (`QuoteRequestService`):**
- `type QuoteItem = { qty: number; text: string; productId: string | null; price: number | null; take: number }`
- `create(input: { name: string; phone: string | null; source: "whatsapp" | "balcao"; title: string; items: QuoteItem[]; toConfirm: string[]; total: number; message: string }): Promise<{ id: string }>`: normaliza o telefone (inválido → null). Telefone válido sem contato → cria `Contact` pendente.
- `list(opts: { q?: string; status?: string }): Promise<Array<{ id; name; phone; title; total; status; createdAt; itemCount }>>`: busca sem acento em nome e por dígitos no telefone. Mais novos primeiro, até 200.
- `get(id): Promise<{ …; items: Array<QuoteItem & { now: { price: number; stock: number; active: boolean } | null }>; toConfirm: string[]; message } | null>`
- `setStatus(id, status)`: só os 4 valores.

- [ ] Testes (falham antes): `salva sem telefone`, `cria contato pendente sem mexer no existente`, `dois pedidos do mesmo telefone`, `busca por nome sem acento e por telefone`, `detalhe traz preço de agora` (muda preço e inativa um produto depois), `setStatus recusa valor inválido`. Implementar → PASS. **Commit** `Orçamentos pedidos: tabela e service`.

### Task 3: Copiloto (service + rota)

**Files:** `src/services/copilotService.ts`, `src/app/api/copilot/route.ts`, `tests/copilotService.test.ts`

**Produces:** `CopilotService.draft(input: { name: string; phone: string; text: string }, deps?: { ai?: (system: string, user: string) => Promise<string> }): Promise<{ reply: string; intent: Intent["kind"]; quoteRequestId: string | null; total: number | null }>`
- **site:** produtos por SKU **ativos**. As linhas somam o mesmo SKU. O `take` vem de `allocate`. Uniforme e sem SKU vão para `toConfirm`.
- **code:** `SavedListService.getQuote(code, { activeOnly: true })`. Não achou → resposta "Não encontrei essa lista…" sem salvar.
- **list:** `buildQuote` + catálogo, com a regra de "parece lista" do robô. Não parece → tratada como `other`.
- O texto do orçamento é `quoteMessage(companyName, title, lines, brl)` + "A loja confirma: …" + rodapé (retirada no endereço de Configurações; valores conferidos agora). Salva `QuoteRequest`.
- **IA:** `deps.ai` padrão = `nvidiaChat` com a chave de Settings.
  - Orçamento → pede abertura de até 2 linhas, usando o primeiro nome. Resposta = abertura + "\n\n" + orçamento.
  - Outra → resposta inteira com os dados da loja (nome, endereço, telefone, `storeHours`): curta, sem inventar preço, oferece montar o orçamento se mandarem a lista.
  - Erro ou falta de chave → abertura fixa `Oi, {primeiro nome}! Segue o orçamento:` / resposta fixa com horário e endereço.
- **Rota:** `POST /api/copilot` só JSON. Valida texto (1–8000 caracteres) e nome (≤ 120). → `{ success, data }`.

- [ ] Testes (falham antes, com `deps.ai` falso): `lista vira orçamento salvo com abertura da IA`, `pedido do site deixa uniforme para a loja confirmar`, `pergunta comum não salva orçamento`, `sem IA ainda responde` (ai lança erro), `código inexistente pede a lista`. Implementar → PASS. **Commit** `Atendimento: copiloto que monta o orçamento e a resposta`.

### Task 4: Rotas de Orçamentos pedidos

**Files:** `src/app/api/quote-requests/route.ts` (GET `?q=&status=`; POST para a Lista Escolar salvar: `{ name, phone, title, items, toConfirm, total, message }`, origem `balcao`), `src/app/api/quote-requests/[id]/route.ts` (GET detalhe; PATCH `{ status }`). Padrão das outras rotas.

- [ ] `tsc` limpo. **Commit** `Orçamentos pedidos: rotas`.

### Task 5: Telas

**Files:**
- `src/app/atendimento/page.tsx`: campos Nome, WhatsApp e Mensagem do cliente → "Gerar resposta". Mostra a resposta editável, o selo "Orçamento salvo — R$ X" com link para o pedido, "Copiar resposta" e "Abrir no WhatsApp" (só com telefone válido). Aviso fixo: "Confira antes de enviar — quem envia é você."
- `src/app/orcamentos/page.tsx`: busca, filtro por situação e lista. O detalhe em painel tem itens (preço da época × agora, estoque), "a loja confirma", mensagem enviada, botões de situação e "Levar para o PDV" (só itens ativos com estoque; `sendToPdv` + `router.push('/pdv')`; marca "retirado" depois de confirmar com `window.confirm`).
- `src/app/lista-escolar/page.tsx`: botão "Salvar orçamento" (pede nome e telefone num diálogo pequeno) → POST `/api/quote-requests`.
- `src/components/Layout.tsx`: "Atendimento" (`MessagesSquare`) e "Orçamentos" (`ClipboardCheck`) no grupo Balcão.
- `src/app/configuracoes/page.tsx`: campo "Horário de funcionamento" no bloco da empresa (texto livre), salvo via `/api/settings` (adicionar `storeHours` aos campos aceitos).

- [ ] `tsc` e `eslint` sem erro. Conferir no app (Postgres local, chave NVIDIA só no banco local): colar uma lista → resposta com abertura + orçamento → aparece em Orçamentos → "Levar para o PDV" coloca os itens no carrinho; dúvida comum → resposta sem orçamento. **Commit** `Atendimento e Orçamentos: telas`.
