# RUNBOOK — Laçolaria em 3 computadores (Supabase)

Arquitetura escolhida (Opção A): **1 computador é o servidor**, os outros 2 abrem
o navegador nele. Os dados ficam num **Postgres do Supabase**, compartilhado.

```
  PC-servidor  ──roda o app──►  http://localhost:3000
       │                              ▲        ▲
       └── Postgres (Supabase) ◄──────┘        │
                                    PC-2 e PC-3 (navegador)
                                    http://<ip-do-servidor>:3000
```

O código já está pronto para Postgres. A `DATABASE_URL` decide o banco:
`postgres://...` usa Supabase; `file:./dev.db` usa o SQLite local (dev offline).

---

## 1. Migrar para o Supabase (fazer uma vez)

No **PC-servidor**, na pasta do projeto:

```bash
# a) coloque a connection string do Supabase no .env
#    Supabase → Project Settings → Database → "Session pooler" (porta 5432)
#    .env:
#    DATABASE_URL="postgres://postgres.<ref>:<senha>@aws-0-<regiao>.pooler.supabase.com:5432/postgres"

# b) cria as tabelas no Supabase
npm run db:migrate            # = prisma migrate deploy
npm run seed                  # cria usuário de sistema, caixa padrão e config

# c) (opcional) levar os dados que já existem no dev.db para o Supabase
npm run db:from-sqlite

# d) (opcional) catálogo de demonstração, se o banco estiver vazio
npm run seed:demo
```

Confira no painel do Supabase (Table editor) se as tabelas apareceram.

## 2. Rodar o servidor

No **PC-servidor**:

```bash
npm run build
npm start                     # sobe em http://localhost:3000
```

Descubra o IP da máquina na rede local (`ipconfig` no Windows → "Endereço IPv4",
algo como `192.168.0.10`). Deixe esse terminal aberto (ou configure como serviço
/ tarefa que inicia com o Windows).

> Firewall: na primeira vez o Windows pode perguntar se libera o Node na rede —
> aceite **redes privadas**.

## 3. PC-2 e PC-3

Abrir o navegador em `http://192.168.0.10:3000` (troque pelo IP do servidor).
Criar um atalho na área de trabalho.

- Cada máquina pede o **PIN** na primeira vez:
  - tela `/senha`: `owner123` (dono) ou `emp123` (funcionário) — vêm do `.env`
  - cadeado da tela: `1234` (fica salvo só naquele navegador; troque em Configurações)
- Dados da empresa, rodapé do comprovante e juros do cartão agora ficam no banco —
  configure **uma vez** em Configurações e vale para as 3 máquinas.

## 4. Impressora (Epson TM-T20X)

A impressora fica ligada no PC onde o caixa imprime (via USB). O comprovante usa
`window.print()` — escolha a Epson como impressora e marque "sem margens".
Largura da bobina (58/80 mm) em Configurações.

---

## Manutenção

| Tarefa | Comando |
|---|---|
| Voltar pro SQLite local | `DATABASE_URL="file:./dev.db"` no `.env` |
| Nova migração após mudar o schema | `npx prisma migrate dev --name <nome>` |
| Aplicar migrações no Supabase | `npm run db:migrate` |
| Backup | Supabase faz backup automático; ou `pg_dump` da connection string |
| Ver/editar dados | Supabase → Table editor, ou `npx prisma studio` |

## Observações

- As migrações antigas de SQLite ficaram em `prisma/migrations-sqlite-backup/`.
- `saleNumber` passou a ser `V<AAAAMMDD>-<aleatório>` — sem colisão entre máquinas.
- Auth por usuário continua desligada; o acesso é só pelo PIN.
