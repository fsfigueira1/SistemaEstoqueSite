# RUNBOOK — Laçolaria em 3 computadores

Cada computador roda o **app Laçolaria** instalado. Os três apontam para o
**mesmo banco Postgres no Supabase** — é assim que os dados (produtos,
estoque, vendas) ficam compartilhados. Não há "PC servidor"; se um cair, os
outros continuam.

```
  PC-1 (app)  ─┐
  PC-2 (app)  ─┼──►  Postgres do Supabase  (produtos, estoque, vendas, config)
  PC-3 (app)  ─┘
```

---

## 1. Preparar o banco no Supabase (uma vez só)

Você precisa da connection string. No Supabase:
**Project Settings → Database → Connection string → "Transaction pooler"** (porta 6543).
Ela multiplexa as conexões — no plano free o "Session pooler" (5432) só tem 15 e
o próprio Supabase já usa boa parte. Fica assim:

```
postgresql://postgres.<ref>:<senha>@aws-0-<regiao>.pooler.supabase.com:6543/postgres?pgbouncer=true
```

Num computador com o projeto (o de desenvolvimento):

```bash
# põe a URL no .env
#   DATABASE_URL="postgresql://postgres.<ref>:<senha>@...pooler.supabase.com:6543/postgres?pgbouncer=true"

npm run db:migrate        # cria as tabelas no Supabase
npm run seed              # usuário de sistema, caixa e linha de config

# (opcional) leva o que já existe no dev.db para o Supabase:
npm i -D better-sqlite3
npm run db:from-sqlite

# (opcional) catálogo de exemplo, se o banco estiver vazio:
npm run seed:demo
```

Confira no Supabase → **Table editor** se as tabelas apareceram.

## 2. Gerar o instalador (uma vez)

No computador de desenvolvimento:

```bash
npm run electron:build
```

Sai em `release/Laçolaria Setup 0.1.0.exe`. Copie esse arquivo para os 3 PCs
(pendrive, rede, etc.).

## 3. Instalar em cada PC (1, 2 e 3)

1. Rode `Laçolaria Setup 0.1.0.exe` → escolhe a pasta, cria atalho, abre no fim.
2. Abra o **Laçolaria**. No ícone da **bandeja** (ao lado do relógio):
   **Configurar banco de dados…** → cole a `DATABASE_URL` do Supabase → salvar.
   O app reinicia já conectado.
3. Ainda na bandeja, marque **Iniciar com o Windows**.
4. Primeiro acesso pede o PIN:
   - tela **/senha**: `owner123` (dono) ou `emp123` (funcionário) — trocáveis
     no `.env` do build
   - **cadeado da tela**: `1234` (fica só naquele PC; troca em Configurações)

Pronto. Os três já compartilham tudo. Configure **dados da empresa, rodapé
do comprovante e juros do cartão** em **Configurações** uma vez — vale para os
três (fica no banco).

## 4. O que o app garante

- **Fica na bandeja** mesmo se fechar a janela (o X não para o sistema).
  Sair de verdade: bandeja → **Sair**.
- Se o servidor interno cair, **sobe de novo sozinho**.
- Se a tela travar, **recarrega sozinha**.
- **Estoque nunca fica pela metade**: cada venda é uma transação — ou grava
  tudo (venda + baixa de estoque + pagamento) ou não grava nada. Queda de
  luz, internet ou crash no meio da venda = nada foi gravado, é só refazer.

## 4a. Sem internet — o PDV continua vendendo (a partir do 0.1.5)

Só o **PDV** funciona offline. Cadastro, caixa, relatórios e painel precisam de
internet (mostram "sem conexão" até voltar).

- O PDV baixa e guarda o **catálogo em cache** quando tem internet. Sem
  conexão, a busca por nome/código lê desse cache ("catálogo de X min atrás").
  Produto criado depois do último cache não aparece até reconectar.
- Venda finalizada sem internet entra numa **fila local** (no navegador daquele
  PC). O comprovante imprime normal (os dados são locais). O estoque é abatido
  no cache do balcão.
- O topo mostra **"Sem conexão · N venda(s) na fila"**.
- Quando a internet volta, a fila **sobe sozinha** pro Supabase (a cada ~45 s ou
  no momento que reconecta). Cada venda leva um `clientId` único, então repetir
  o envio nunca duplica.
- **Defasagem aceitável:** o estoque no Supabase fica alguns minutos atrás do
  balcão. Se um gerente mexer no estoque de um produto enquanto o balcão estava
  offline, o estoque pode ir a negativo no flush — a venda é registrada mesmo
  assim; ajuste o estoque na mão depois.
- Fila e cache ficam no IndexedDB do app e **sobrevivem a fechar o app e a
  atualizações**. Só somem se limpar os dados do site.

## 5. Impressora (Epson TM-T20X)

Fica no USB do PC onde o caixa imprime. Ao finalizar a venda, o app pergunta
"Imprimir comprovante?". Escolha a Epson e marque "sem margens". Largura da
bobina (58/80 mm) em Configurações.

---

## Manutenção

| Tarefa | Como |
|---|---|
| Trocar a URL do banco num PC | bandeja → Configurar banco de dados… |
| Nova migração após mudar o schema | `npx prisma migrate dev --name <nome>` (dev, com banco local) |
| Aplicar mudança de schema no Supabase | Rode o SQL do `migration.sql` no **Supabase → SQL Editor**. O `npm run db:migrate` (Prisma Migrate) **trava pelo Transaction pooler** — só funciona com conexão direta (porta 5432). |
| Novo instalador após mudar o código | `npm run electron:build` e reinstalar |
| Backup | Supabase faz automático; ou `pg_dump` da connection string |
| Ver/editar dados | Supabase → Table editor, ou `npx prisma studio` |
| Erro "max clients reached / EMAXCONNSESSION" | Supabase → Database → Connection Pooling → aumente o **Pool Size**; ou baixe `DB_POOL_MAX` (env) pra 1 em cada PC |

## Observações

- Migrações antigas de SQLite: `prisma/migrations-sqlite-backup/`.
- `saleNumber` = `V<AAAAMMDD>-<aleatório>` — sem colisão entre máquinas.
- Auth por usuário está desligada; o acesso é só pelo PIN.
- Para voltar ao SQLite local: `git revert` do commit da migração Postgres.
