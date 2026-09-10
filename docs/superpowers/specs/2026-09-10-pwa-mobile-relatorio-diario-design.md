# PWA de consulta (somente leitura) + relatório diário das 19h

**Data:** 2026-09-10
**Status:** aprovado, em implementação

## Objetivo

1. Uma **PWA mobile-first, somente leitura**, publicada na Vercel, para
   acompanhar o negócio pelo iPhone (adicionar à tela de início) sem depender
   de nenhum PC ligado.
2. Um **relatório do dia gerado às 19:00 (horário de Brasília)** por um cron
   central, visível tanto na PWA quanto no app de computador (Electron).

## Não-objetivos (YAGNI)

- PDF, impressão térmica, notificações push.
- Quebra por forma de pagamento, produtos mais vendidos, estoque ou
  fechamento de caixa **no relatório** — só o resumo de vendas.
- Service worker / offline na v1.
- App nativo / App Store.
- Login por usuário — um único PIN de leitura compartilhado.
- Qualquer capacidade de escrita na PWA.

## Topologia

| Peça | Papel |
|---|---|
| Vercel | Deploy do mesmo repo Next. Env: `DATABASE_URL` (pooler Supabase 6543), `READ_ONLY=1`, `VIEWER_PIN`, `CRON_SECRET` (injetado pela Vercel). |
| Electron (PC) | Sem `READ_ONLY`. Ganha a tela `/relatorio`, que lê `daily_reports` pelo Prisma já embarcado. |
| Supabase Postgres | Nova tabela `daily_reports`. |

**Fluxo do relatório:** Vercel Cron `0 22 * * *` (UTC) → `POST /api/cron/daily-report`
→ calcula vendas `COMPLETED` do dia corrente no fuso `America/Sao_Paulo`
→ `upsert` idempotente em `daily_reports` por `date`. Os dois clientes só leem.

## Componentes

### 1. Helper de fuso — `src/lib/brtDay.ts`

`brtDayString(date: Date): string` → `"YYYY-MM-DD"` do dia civil em
`America/Sao_Paulo`, via `Intl.DateTimeFormat` (não hardcode de -3).
`brtDayRange(dayString: string): { start: Date; end: Date }` → limites UTC
do dia BRT, para filtrar `Sale.createdAt`.

### 2. Resolução de PIN — `src/lib/auth.ts`

`resolveRole(pin, env): 'OWNER' | 'EMPLOYEE' | 'VIEWER' | null`.
`VIEWER` quando `pin === env.VIEWER_PIN` (e `VIEWER_PIN` definido).
Usado por `POST /api/senha`; grava cookie `erp_auth=<role>:<ts>`.

### 3. Trava de escrita — `src/lib/readOnly.ts` + `src/proxy.ts`

`readOnlyDecision({ method, pathname, headers, env })`:
- `env.READ_ONLY !== '1'` → `{ allow: true }`.
- método `GET`/`HEAD`/`OPTIONS` → `{ allow: true }`.
- `pathname` começa com `/api/cron/` e header `authorization === "Bearer " + env.CRON_SECRET` → `{ allow: true }`.
- senão → `{ allow: false, status: 403 }`.

`src/proxy.ts` chama o helper antes da lógica de cookie e devolve 403 quando `allow` é falso.

### 4. Modelo Prisma — `DailyReport`

```prisma
model DailyReport {
  date          DateTime @id @db.Date   // dia civil BRT
  generatedAt   DateTime
  totalAmount   Decimal  @default(0)
  salesCount    Int      @default(0)
  averageTicket Decimal  @default(0)
}
```

Migração aplicada no Supabase pelo **SQL Editor** (o `prisma migrate` trava no
Transaction pooler — ver RUNBOOK). SQL versionado em
`prisma/migrations-manual/2026-09-10-daily-report.sql`.

### 5. `src/services/dailyReportService.ts`

- `generateForDate(day: string)` — usa `SaleService.getSalesStatistics` com
  `brtDayRange(day)` e `status: COMPLETED`; `upsert` em `daily_reports`.
  Retorna a linha.
- `list(limit = 90)` — `daily_reports` ordenado por `date` desc.
- `getByDate(day: string)` — uma linha ou `null`.

### 6. Rotas de API

| Rota | Método | Descrição |
|---|---|---|
| `/api/cron/daily-report` | `POST` | Valida `Authorization: Bearer $CRON_SECRET`; chama `generateForDate(brtDayString(new Date()))`; 200 com a linha. 401 sem secret. |
| `/api/daily-reports` | `GET` | `list()` — os 90 mais recentes. |
| `/api/daily-reports/[date]` | `GET` | `getByDate(date)`; 404 se não existir. |

Todas passam pela trava `READ_ONLY` (as `GET` sempre liberadas; o cron pela exceção do secret).

### 7. `vercel.json`

```json
{ "crons": [{ "path": "/api/cron/daily-report", "schedule": "0 22 * * *" }] }
```

`0 22 * * *` UTC = 19:00 BRT (Brasil sem horário de verão desde 2019).

### 8. Casca da PWA — `src/app/(mobile)/m/`

- `layout.tsx` próprio (sem a sidebar desktop): conteúdo + **tab bar inferior**
  com Painel · Produtos · Estoque · Vendas · Relatório, com `padding-bottom`
  de safe-area.
- Páginas (client components, `fetch` nos `GET /api/*` existentes, só leitura):
  - `/m/painel` — cards de `GET /api/dashboard/stats`.
  - `/m/produtos` — lista de `GET /api/products` com busca.
  - `/m/estoque` — `GET /api/products` destacando baixo/esgotado.
  - `/m/vendas` — `GET /api/sales` recentes.
  - `/m/relatorio` — ver §9.
- Sem redirect automático por user-agent; acessa-se `…/m`.

### 9. Tela "Relatório do dia" (PWA `/m/relatorio` e desktop `/relatorio`)

- Cabeçalho: data + "gerado às 19:00".
- Três números: **total vendido**, **nº de vendas**, **ticket médio**.
- Antes das 19h de hoje: aviso "ainda não gerado — sai às 19:00" + prévia
  **parcial** (via `GET /api/dashboard/stats`), rotulada como parcial.
- Abaixo: lista dos **últimos 90 dias** (de `GET /api/daily-reports`); tocar
  abre os números daquele dia (`GET /api/daily-reports/[date]`).
- Componente de apresentação compartilhado entre as duas telas.

### 10. PWA plumbing

- `public/manifest.webmanifest` — nome, `display: standalone`, `theme_color`,
  `background_color`, ícones 192/512 + `maskable`.
- `src/app/layout.tsx` — `manifest` no metadata, `apple-mobile-web-app-capable`,
  `apple-mobile-web-app-status-bar-style`, `apple-touch-icon`,
  `viewport-fit=cover`.
- Ícones em `public/` (derivados do `logo.png`).

### 11. Nav no desktop

Entrada "Relatório" no `src/components/Layout.tsx` apontando para `/relatorio`.

## Testes

**Unitário puro (sem banco — o harness de teste do repo está em transição
SQLite→Postgres e não roda sem `DATABASE_URL`):**

- `brtDay`: venda 2026-03-10T23:30 BRT cai em `2026-03-10`, não `03-11`;
  `brtDayRange` devolve limites UTC corretos.
- `resolveRole`: PIN do viewer → `VIEWER`; PIN errado → `null`;
  `VIEWER_PIN` ausente + qualquer pin → nunca `VIEWER`.
- `readOnlyDecision`: `GET` sempre passa; `POST` com `READ_ONLY=1` → 403;
  `POST /api/cron/x` com Bearer certo → passa; secret errado → 403;
  `READ_ONLY` desligado → tudo passa.

**Verificado por `tsc` + lint + manual:** `DailyReportService` (upsert/list),
rotas de API, cron (`curl` local com o secret), telas.

## Ordem de implementação

1. Este spec.
2. Helpers puros com TDD (`brtDay`, `auth`, `readOnly`).
3. Modelo `DailyReport` + SQL de migração.
4. `DailyReportService` + rotas de API.
5. `READ_ONLY`/`CRON_SECRET` no `proxy.ts`; `VIEWER_PIN` no `/api/senha`.
6. `vercel.json` + `.env.example`.
7. Route group `(mobile)/m` + páginas.
8. PWA manifest/ícones/meta.
9. Tela `/relatorio` desktop + nav.
10. `tsc`, lint, instruções de deploy.
