# HANDOFF — estado do projeto (para retomar numa sessão nova)

Se você abriu uma sessão nova do Claude Code, leia este arquivo + `git log` +
`DESIGN.md` + `RUNBOOK.md` para pegar todo o contexto.

## O que é

**Laçolaria** — sistema de gestão + PDV de uma papelaria. Next.js 16 (App
Router), React 19, TypeScript, Prisma 7, Tailwind v4. Empacotável em Electron.
Auth por usuário está **desligada de propósito**: acesso só por PIN
(tela `/senha`, PINs no `.env`; e um cadeado local por navegador via
`PinLock`, padrão `1234`, trocável em Configurações).

## O que foi feito nesta rodada (13 commits sobre `f9d3e9b`)

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
   de pagamento, backup automático pela interface.

## Arquivos-guia

- `RUNBOOK.md` — passo a passo dos 3 computadores + Supabase
- `DESIGN.md` — sistema visual (tokens Tiffany, tipografia, dark mode)
- `prisma/migrations-sqlite-backup/` — migrações antigas de SQLite (referência)
