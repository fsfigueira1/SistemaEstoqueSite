# HANDOFF — estado do projeto (para retomar numa sessão nova)

Se você abriu uma sessão nova do Claude Code, leia este arquivo + `git log` +
`DESIGN.md` + `RUNBOOK.md` para pegar todo o contexto.

## O que é

**Laçolaria** — sistema de gestão + PDV de uma papelaria. Next.js 16 (App
Router), React 19, TypeScript, Prisma 7, Tailwind v4. Empacotável em Electron.
Auth por usuário está **desligada de propósito**: acesso só por PIN
(tela `/senha`, PINs no `.env`; e um cadeado local por navegador via
`PinLock`, padrão `1234`, trocável em Configurações).

## Rodada 0.3.0 — compras, taxas, backup, pagamento dividido, lista escolar

Branch `feat/compras-taxas-backup`.

**Novo**
- **Taxas da maquininha e Pix** (Configurações → `#taxas`): % de débito,
  crédito à vista, crédito parcelado (0 = usa o do à vista) e Pix. O relatório
  do dia mostra "Cai na conta R$ X · taxa R$ Y" no Cartão e no Pix, e a
  assistente fala do total de taxas. Regras em `src/lib/closing.ts`
  (`feePercent`, `feeAmount`, `feeRatesOf`); estorno devolve a taxa.
  A conferência continua comparando o valor bruto (o que a maquininha mostra).
- **Backup automático diário** (`src/services/backupService.ts`, ligado em
  `src/instrumentation.ts`): em cada PC, 3 min depois de abrir e depois de hora
  em hora, se ainda não tem arquivo do dia, grava
  `lacolaria-backup-AAAA-MM-DD-HHMM.json.gz` (todas as tabelas do schema
  `public`, numa transação só, **sem** `aiApiKey`/`shoppingApiKey`) em
  Documentos\Lacolaria Backups (ou a pasta escolhida em Configurações →
  Backup; dá para usar Google Drive/OneDrive). Guarda os N mais novos (padrão 30).
  Tela: fazer agora, baixar, abrir/trocar pasta (IPC `open-backup-folder` /
  `choose-backup-folder` no Electron). Restaurar: `npm run backup:restore` (ver
  RUNBOOK). Regras puras em `src/lib/backupFormat.ts`.
- **Sugestão de compra** (`/compras`): soma o que vendeu nos últimos N dias
  (vendas concluídas) e sugere `venda/dia × dias a cobrir + mínimo − estoque`
  (limitado ao máximo), agrupado por fornecedor, urgentes primeiro. Quantidade
  editável, "Copiar pedido" e WhatsApp (wa.me) por fornecedor; produtos sem
  fornecedor ganham o seletor ali mesmo. Regras em `src/lib/restock.ts`.
  Cadastro de produto ganhou o campo **Fornecedor** (`SupplierSelect`, com
  "+ Novo fornecedor…"). `PUT /api/products/[id]` não apaga mais o código de
  barras numa edição parcial.
- **Pagamento dividido + Débito no PDV** (`src/components/pdv/PaymentPanel.tsx`,
  regras em `src/lib/payments.ts`): Dinheiro / Pix / Débito / Crédito, e
  "Dividir pagamento" (até 4 partes; a última fica com o restante). Juros do
  cartão só na parte de crédito parcelado. `POST /api/sales/checkout` aceita
  `payments: [{ method, amount, installments }]` (e ainda o `payment` antigo,
  para a fila offline); cada parte vira um `SalePayment`. Estorno devolve
  todas as partes. Comprovante lista cada forma (`ReceiptPayments.tsx`).
- **Lista escolar** (`/lista-escolar`): cola o texto ou tira foto da lista.
  A foto é lida no próprio PC (tesseract.js, português, arquivos em
  `public/ocr`, copiados por `scripts/copy-ocr-assets.cjs` no build — fora do
  git) ou com o Claude se houver chave ("Ler com IA", bom para letra de mão).
  O app acha quantidade e casa cada item com os produtos
  (`src/lib/schoolList.ts`), mostra estoque, total do que tem, e manda por
  WhatsApp ou "Levar para o PDV" (carrinho preenchido via `src/lib/pdvPrefill.ts`).

**Banco**: 6 colunas novas em `Settings` (taxas e backup) — `schemaUpgrade`
aplica sozinho; SQL em `prisma/migrations/20260925030000_fees_backup/`.

**Testes**: `src/lib/*.test.ts` (backup, compras, pagamentos, lista escolar,
taxas). A suíte antiga segue com as falhas pré-existentes.

## Rodada 0.2.0 — relatórios, assistente, IA de preços, erros simples, visual "gourmet"

Branch `feat/relatorios-ia-assistente`.

**Novo**
- `/relatorios` (lista de dias) e `/relatorios/AAAA-MM-DD` (página do dia):
  entradas por **Dinheiro / Cartão (crédito+débito) / Pix**, estornos
  descontados no dia do estorno, e **conferência do caixa** (fundo de troco,
  retiradas, valores contados → "Bateu / Faltam / Sobram"). Salva em `DailyClosing`.
  Regras em `src/services/reportService.ts` (topo) e `src/lib/closing.ts`.
- **Assistente do dia** (`src/components/DailyAssistant.tsx`): aparece no
  horário configurado (padrão 18:00) se houve venda e o caixa não foi conferido.
  "30 min" adia; fechar dispensa até amanhã (preferência local do PC).
- **Pesquisa de preço no cadastro** (`src/services/priceAdvisorService.ts`,
  `src/components/PriceAdvisor.tsx`). Duas fontes, escolhidas em
  Configurações → "Pesquisa de preço":
  - **Google Shopping via SerpApi — padrão, grátis** (250 buscas/mês, conta
    grátis sem cartão em serpapi.com). Pelo código de barras (ou nome) traz as
    ofertas das lojas brasileiras; tiramos usados, kits e preços fora da curva.
    Sugestão = mediana das lojas + "toque da loja" (padrão 10%), final
    ",50/,90", nunca abaixo de custo + 30%. Regras puras em
    `src/lib/shoppingPricing.ts`, chamada HTTP em
    `src/services/pricing/shoppingProvider.ts` (contador de buscas pelo
    `account.json`, que não gasta busca). Cache de 30 dias (só resultados com preço).
    Obs.: o Cosmos (Bluesoft) foi avaliado e descartado — não tem mais plano grátis
    (mínimo R$ 499,99/mês).
  - **Claude — pago** (`src/services/pricing/claudeProvider.ts`): IA com
    `web_search_20250305`, considera o perfil da loja. Cache de 7 dias.
  No cadastro novo, um EAN válido dispara a pesquisa sozinho e preenche o nome.
  Resultados em `PriceCheck` (coluna `provider`). Aviso "abaixo do mercado" em
  Produtos e no relatório. Chave da SerpApi e chave do Claude ficam no banco e
  **nunca** voltam pela API (`publicSettings`). `SERPAPI_BASE_URL` e
  `ANTHROPIC_BASE_URL` permitem apontar para simuladores nos testes.
- **Erros simples**: `src/lib/friendlyError.ts` transforma qualquer erro
  (Prisma, rede, serviços em inglês) em nome curto ("Estoque insuficiente",
  "Sem conexão"). Usado no `errorHandler`, nas rotas e nas telas (`errorText`).
- **Visual**: Fraunces + Inter locais, trilho escuro, `PageHeader`, tela de PIN
  nova — ver `DESIGN.md`.

**Banco**: colunas novas em `Settings` (inclui `priceProvider`, `shoppingApiKey`,
`priceMarkupPercent`) + tabelas `DailyClosing` e `PriceCheck`.
Cada PC aplica sozinho ao abrir (`src/lib/schemaUpgrade.ts`, tudo `IF NOT EXISTS`).
O mesmo SQL está em `prisma/migrations/20260924120000_reports_ai/migration.sql`
se quiser rodar no SQL Editor do Supabase antes.

**Testes**: `src/lib/*.test.ts` (52 testes). A suíte antiga tem 47 falhas
pré-existentes (stock/payment/productApi/integração) — iguais antes e depois.

## Rodada anterior (13 commits sobre `f9d3e9b`)

| Commit | Assunto |
|---|---|
| `4e171b1` | limpeza: 127 worktrees órfãos, ~130 arquivos de lixo, `.gitignore` |
| `3b8b87c` | wip: checkpoint do trabalho que estava solto (ponto de restauração) |
| `55e3659` | Prisma alinhado em v7 + SQLite |
| `fae2c56` | fix: import de enum do Prisma em componentes client |
| `2c8eafc` | fix: tela preta em `/produtos` + `bg-opacity` do Tailwind v4 |
| `a4d8440` | remove `proxy.ts` morto, wrappers/PinLock duplicados, árvores `X/X/` |
| `e570cd4` | **PDV**: leitor de código, busca por nome, finalização, baixa de estoque |
| `eb6a04b` | reescreve a página de cadastro de produtos |
| `2ad44e1` | Dashboard em pt-BR + página de Vendas + página de Configurações |
| `0684bae` | **redesign**: identidade azul Tiffany, tema claro/escuro (`DESIGN.md`) |
| `9f72ffb` | juros de cartão parcelado + estorno de venda |
| `f190f32` | remove rotas mortas `/products`, `/relatorios` |
| `fc00ab1` | **migração para Postgres/Supabase** (3 computadores) — ver `RUNBOOK.md` |

## Estado atual

- `npm run build` **OK** · `tsc` **0 erros** · fluxos validados via Playwright
  (claro/escuro, desktop/mobile) e via API contra um Postgres real.
- Working tree limpo.
- **O app agora é Postgres-only.** `npm run dev` local precisa de uma
  `DATABASE_URL` postgres:// (Supabase, ou `npx prisma dev` para offline).
  O `.env` está com `DATABASE_URL=` vazio de propósito.
- Dados antigos do `dev.db` continuam no disco; `npm run db:from-sqlite` leva
  eles para o Postgres.

## Como rodar (dev)

```bash
# opção 1: Postgres local descartável
npx prisma dev                 # copie a URL postgres:// que ele imprime
# cole em DATABASE_URL no .env, então:
npm run db:migrate && npm run seed && npm run seed:demo
npm run dev

# opção 2: já contra o Supabase — ver RUNBOOK.md seção 1
```

Login: tela `/senha` PIN `owner123`; cadeado `1234`.

## Pendências / próximos passos

1. **Colocar a `DATABASE_URL` do Supabase** e rodar a seção 1 do `RUNBOOK.md`
   (é o passo que faltou — o usuário tem o projeto Supabase mas não mandou a URL).
2. Ligar os 3 computadores conforme `RUNBOOK.md` (1 servidor + 2 navegadores).
3. Impressora Epson TM-T20X: `window.print()`, escolher a Epson, "sem margens".
4. Opcional: acabamento fino de design (`/impeccable polish`), TEF/conciliação
   de pagamento, restauração de backup pela interface.

## Arquivos-guia

- `RUNBOOK.md` — passo a passo dos 3 computadores + Supabase
- `DESIGN.md` — sistema visual (tokens Tiffany, tipografia, dark mode)
- `prisma/migrations-sqlite-backup/` — migrações antigas de SQLite (referência)
