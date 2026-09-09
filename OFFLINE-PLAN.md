# Plano — PDV offline com sincronização

Objetivo: **o balcão não para sem internet.** Cache local de produtos/preços +
fila local de vendas que sobe pro Supabase sozinha quando a conexão volta.
Defasagem de estoque de alguns minutos é aceitável.

## Arquitetura real (importante)

**1 PC de venda** (o balcão). Os outros 2 só gerenciam/olham (cadastro, preços,
relatórios). Ou seja: **só uma máquina escreve venda e mexe em estoque por
venda.** Não há duas caixas concorrentes → sem conflito de venda entre
máquinas, sem resolução de conflito, sem risco de "os dois venderam a última
unidade". A fila é de um escritor só, flush em ordem.

## Escopo

**Fica offline:** só o caminho de venda do PDV (`/pdv`) — busca por código/nome,
carrinho, finalizar venda, imprimir comprovante.

**Continua só online (mostra "sem conexão" se cair):** cadastro de produtos,
categorias, fornecedores, compras, abrir/fechar caixa, relatórios, painel,
configurações.

**Modo de falha alvo:** o servidor Next local (dentro do Electron) está no ar; o
que cai é a internet até o Supabase. Por isso a camada offline vive no
**renderer** (a página), não no servidor — é o menor risco pro checkout atômico
que já funciona.

## Decisões

| Tema | Decisão |
|---|---|
| Onde mora o offline | No renderer (IndexedDB). O servidor Next quase nunca é o problema. |
| Cache de produtos | Lista `ACTIVE` inteira baixada quando online, guardada em IndexedDB. Busca por código/nome resolve no cache (offline e também mais rápido online). |
| Fila de vendas | IndexedDB. Cada venda tem `clientId` (UUID gerado no navegador) + carimbo de tempo. |
| Anti-duplicata | Coluna nova `Sale.clientId @unique`. No flush, se já existe venda com aquele `clientId`, o servidor devolve a existente (200) em vez de duplicar. |
| Estoque offline | Decrementa no cache local após a venda (impede revender o mesmo item na mesma sessão offline e mantém a validação do carrinho). O servidor faz o decremento real no flush. |
| Conflito de estoque | Como só 1 PC vende, o único caso é um gerente ter mexido no estoque de um produto enquanto o balcão estava offline → o flush pode passar o estoque server a negativo. Raro. Aceito: registra a venda e loga um aviso. Não bloqueia. |
| Sessão de caixa | Guarda o id da sessão aberta quando online. Venda offline usa esse id. No flush, se o próprio operador fechou o caixa antes de a fila subir, o servidor reaponta pra sessão aberta atual (ou abre uma). |
| `createdAt` da venda | Usa o carimbo de tempo do cliente (`occurredAt` no payload), não a hora do flush — pros relatórios ficarem certos. |

## Mudança no banco (Supabase)

Migração única, aplicada **antes** de qualquer app 0.1.5 rodar:

```prisma
model Sale {
  // ...
  clientId String? @unique   // chave de idempotência do PDV offline
}
```

`npm run db:migrate` contra o Supabase. Apps 0.1.4 continuam funcionando
(não mandam `clientId`, a coluna é opcional).

## Arquivos

### Renderer — novo

- `src/lib/offline/db.ts` — abre o IndexedDB (via `idb`), stores `products` e `saleQueue`.
- `src/lib/offline/productCache.ts`
  - `refreshProductCache()` — `GET /api/products?status=ACTIVE&limit=100000` → grava.
  - `findByBarcode(code)`, `searchByName(term, limit)` — leem do cache.
  - `applyLocalStockDelta(items)` — abate estoque no cache depois de uma venda offline.
  - `cacheAgeMinutes()` — pra mostrar "catálogo de há X min" quando offline.
- `src/lib/offline/saleQueue.ts` — `enqueue(sale)`, `list()`, `remove(clientId)`, `markFailed(clientId, reason)`, `count()`.
- `src/lib/offline/sync.ts` — `flushQueue()`:
  - pra cada venda pendente: `POST /api/sales/checkout` com `clientId` + `queued: true`.
  - 2xx → `remove(clientId)`.
  - 409/já-existe → `remove(clientId)`.
  - erro de rede → para o loop, tenta de novo depois.
  - outro erro → `markFailed` (fica na fila, aparece na UI).
- `src/components/OfflineSync.tsx` — montado no layout. Ouve `online`/`offline` +
  intervalo de 30s. Chama `refreshProductCache()` (online) e `flushQueue()`.
  Publica o número de pendentes (contexto simples) pra um badge.

### Renderer — mudança em `src/app/pdv/page.tsx`

- No mount, se online: `refreshProductCache()`.
- Leitura de código: tenta `GET /api/products/barcode/[code]` com timeout curto
  (~1,5s); em falha ou offline → `productCache.findByBarcode`.
- Busca por nome: usa o cache direto (mais rápido); atualiza o cache em segundo plano.
- `finalizarVenda`:
  - monta o payload com `clientId = crypto.randomUUID()`, `occurredAt = new Date()`,
    `cashSessionId` do cache.
  - online: `POST /api/sales/checkout` como hoje. Se der **erro de rede**, cai no passo offline.
  - offline / caiu: `saleQueue.enqueue(payload)` + `productCache.applyLocalStockDelta(items)`
    + mostra "Venda salva. Vai subir quando a internet voltar." O comprovante
    **imprime igual** (todos os dados são locais).
- Indicador de topo: "Sistema online" / "Sem conexão — N venda(s) na fila".

### Servidor — mudança

- **Migração** `Sale.clientId`.
- `POST /api/sales/checkout`:
  - aceita `clientId`, `occurredAt`, `queued` no body.
  - se `clientId` e já existe venda com ele → devolve a existente (200).
  - repassa `clientId` e `createdAt = occurredAt` pro `SaleService.createSale`/`completeSale`.
  - `queued: true` → relaxa a rejeição por estoque insuficiente: registra a venda,
    deixa o estoque ir a negativo, devolve `warnings: [...]`.
  - resolve `cashSessionId`: se não existe ou está `CLOSED`, aponta pra sessão
    aberta atual do caixa (ou abre uma).
- `SaleService.createSale` / `completeSale`: aceitar e gravar `clientId`; usar
  `occurredAt` como `createdAt` quando vier.
- `RUNBOOK.md`: seção "sem internet — o que acontece".

### Dependência nova

- `idb` (~1 KB, wrapper de IndexedDB). Nenhum framework de sync.

## Casos de borda

- App fechado com fila cheia → IndexedDB persiste → sobe no próximo abrir.
- App atualizado (0.1.5→0.1.6) → IndexedDB sobrevive (mesma origem).
- Flush parcial, conexão cai no meio → cada venda sai da fila só no próprio
  sucesso → seguro retomar.
- Colisão de `saleNumber` entre PCs offline → `V<data>-<aleatório>`, chance
  ínfima; se acontecer, o servidor devolve 409 (não-dup-clientId) e o cliente
  gera outro número.
- Catálogo desatualizado offline: mostrar "catálogo de há X min"; produto criado
  depois do último cache não aparece até reconectar.

## Fases

1. **Migração + idempotência** (`clientId`, checkout aceita `queued`/`occurredAt`,
   resolve sessão fechada, relaxa estoque). ~0,5 sessão.
2. **Cache + fila + sync** (`src/lib/offline/*`, `OfflineSync.tsx`, dep `idb`). ~1 sessão.
3. **Fiar no PDV** (busca via cache, `finalizarVenda` com fallback, estados de UI,
   badge de pendentes). ~1 sessão.
4. **Teste + RUNBOOK + build 0.1.5** (Playwright: online→cache, derruba rede→venda
   na fila + comprovante, volta→flush; idempotência: mesmo `clientId` 2x = 1 venda).
   ~0,5 sessão.

≈ 2,5–3 sessões focadas.

## Ordem de deploy do 0.1.5

1. Merge na `master` + `npm run db:migrate` no Supabase (adiciona `clientId`).
2. Build + publica 0.1.5 (ou instala manual). Apps 0.1.4 seguem funcionando.
