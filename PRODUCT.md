# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

<!-- Entrega: app Windows instalado via Electron/NSIS (wrapper sobre o app Next.js).
     Não é site hospedado acessado por navegador — ver Capabilities and Constraints. -->

## Users

**Usuário principal:** funcionário no balcão da papelaria, batendo venda no PDV —
leitor de código de barras, busca por nome, finalizar venda, imprimir comprovante.
É o caminho crítico e a superfície mais usada no dia.

**Usuário secundário:** dona/dono da loja fazendo gestão — cadastro de produtos,
preços e histórico de preço, compras/fornecedores, abertura e fechamento de caixa,
clientes, e o painel do dia (faturamento, vendas, ticket).

**Acesso:** só por PIN. Tela `/senha` com PIN de dono e PIN de funcionário
(arquétipos "dono" e "funcionário"), mais um cadeado local por navegador (`PinLock`).
Não há contas de usuário nem login individual.

## Product Purpose

Sistema de gestão + PDV para papelarias pequenas. Substitui a combinação de
caderno/planilha + PDV genérico por um app único que a loja instala em cada PC;
todos os PCs da mesma loja compartilham um Postgres (Supabase) e enxergam os
mesmos produtos, estoque e vendas.

Sucesso = venda batida rápido no balcão sem o sistema travar, estoque sempre
coerente com o que saiu, e o dono conseguindo ver o dia sem esforço.

## Positioning

Coisas que uma planilha ou um PDV genérico não entregam da mesma forma:

- **Roda sozinho.** Fica na bandeja do Windows (fechar a janela não para o
  sistema), sobe de novo se o servidor interno cair, recarrega a tela se travar.
  Não existe "PC servidor" — qualquer PC da loja pode cair sem derrubar os outros.
- **Venda atômica.** Venda + baixa de estoque + pagamento gravam numa transação
  só. Queda de luz, internet ou crash no meio da venda = nada foi gravado, é só
  refazer. Estoque nunca fica pela metade.
- **Sem burocracia de conta.** Acesso por PIN em vez de usuários/senhas
  individuais — simplicidade deliberada para loja pequena/familiar.
- **Feito para papelaria de balcão.** Leitor de código, comprovante não-fiscal
  com rodapé configurável, juros de cartão parcelado, largura de bobina 58/80 mm,
  numeração de venda sem colisão entre máquinas.
- **Português do Brasil de ponta a ponta.**

**Escopo declarado:** a intenção é oferecer o sistema a outras papelarias, não
só à Laçolaria. Hoje isso significa um *deployment replicável por loja* (cada
loja com seu próprio banco), não um SaaS multi-tenant hospedado — ver a nota de
arquitetura em Capabilities and Constraints.

## Operating Context

- **Cena:** balcão de papelaria. PC com leitor de código de barras (QuaggaJS) e
  impressora térmica Epson TM-T20X no USB. Impressão do comprovante via
  `window.print()` ("sem margens"); largura da bobina (58/80 mm) configurável.
- **Topologia:** até ~3 PCs por loja, todos apontando para o mesmo Postgres no
  Supabase (Transaction pooler, porta 6543). Plano free do Supabase tem ~15
  conexões no total, então o pool por PC é limitado (env `DB_POOL_MAX`).
- **Instalação:** Windows, via instalador Electron/NSIS. Inicia com o Windows.
  Ícone da mascote na bandeja, com "Configurar banco de dados…" (cola a
  `DATABASE_URL` e o app reinicia conectado).
- **Internet instável é esperada.** O app abre offline; as telas de dados dão
  erro até reconectar; nada é perdido.
- **Caixa:** abre sessão de caixa, registra movimentos (sangria/suprimento),
  fecha com resumo.
- **Configuração única compartilhada:** dados da empresa, rodapé do comprovante,
  juros do cartão e bobina ficam no banco → valem para todos os PCs da loja.
- Guias operacionais no repo: `RUNBOOK.md` (3 PCs + Supabase), `HANDOFF.md`.

## Capabilities and Constraints

**Módulos construídos:**

- Produtos/catálogo: SKU, código de barras, categorias, status
  (`ACTIVE`/`INACTIVE`/`DISCONTINUED`).
- Estoque + histórico de movimentação, 9 tipos: `PURCHASE`, `SALE`,
  `SALE_RETURN`, `PURCHASE_RETURN`, `LOSS`, `THEFT`, `ADJUSTMENT_IN`,
  `ADJUSTMENT_OUT`, `CORRECTION`.
- PDV / checkout atômico (`/api/sales/checkout`): venda + itens + baixa de
  estoque + pagamento numa chamada/transação.
- Vendas: estados `PENDING`/`COMPLETED`/`CANCELLED`/`REFUNDED`; estorno; recibo
  não-fiscal (`/api/sales/[id]/receipt`).
- Pagamentos: `CASH`, `PIX`, `CREDIT_CARD`, `DEBIT_CARD`; processamento,
  falha de pagamento, juros de cartão parcelado.
- Caixa: registradoras, sessões (`OPEN`/`CLOSED`), movimentos
  (`OPENING`/`WITHDRAWAL`/`DEPOSIT`/`SALE`/`ADJUSTMENT`).
- Fornecedores, clientes, ordens de compra (`PENDING`/`COMPLETED`/`CANCELLED`/
  `REFUNDED`), histórico de preços.
- Trilha de auditoria (`AuditLog`) com estatísticas e limpeza.
- Painel / estatísticas do dia; configurações (`Settings`, linha única).

**Papéis:** o enum `Role` do schema tem `ADMIN`/`MANAGER`/`USER`/`OWNER`/
`EMPLOYEE` e o projeto carrega NextAuth/Auth.js, mas a autenticação por usuário
está **desligada de propósito**; na prática o acesso é só por PIN (dono vs.
funcionário).

**Detalhes técnicos a preservar:**

- `saleNumber` = `V<AAAAMMDD>-<aleatório>` — sem colisão entre máquinas.
- Postgres-only (`@prisma/adapter-pg`). O SQLite antigo (`dev.db`) foi aposentado;
  `npm run db:from-sqlite` só existe para migrar dados legados uma vez.

**Restrições permanentes (confirmadas pelo usuário):**

1. **Comprovante sempre não-fiscal.** Sem NF-e / NFC-e / SAT / integração fiscal.
2. **Acesso só por PIN.** Sem contas de usuário / login individual — permanente.
3. **Tolerar internet instável.** O app precisa abrir e se recuperar sozinho
   quando a conexão com o Supabase cai e volta.
4. **Alvo definitivo é app Windows via Electron.** Não vira site hospedado
   acessado por navegador.

**Nota de arquitetura (fato durável, não inventar em cima):** o schema não tem
coluna de loja/tenant. A arquitetura atual é *uma loja por instalação*, com um
Postgres por loja. "Produto para várias papelarias" hoje = instalar o mesmo app
em outra loja com seu próprio banco. Trabalho futuro não deve assumir isolamento
multi-tenant que ainda não existe.

## Brand Commitments

- **Nome:** Laçolaria (papelaria). `productName` do app = "Laçolaria";
  `appId` = `com.lacolaria.gestao`.
- **Mascote da Laçolaria** é o ícone do app e do executável
  (`public/icon.*`, `electron/icon.ico` multi-resolução 16–256).
- **Idioma:** pt-BR em toda a interface.
- O sistema visual (azul Tiffany, Bricolage Grotesque, tema claro/escuro) está
  documentado em `DESIGN.md` — fora do escopo deste arquivo.

## Evidence on Hand

- Base de código completa e validada: `npm run build` OK, `tsc` 0 erros, fluxos
  cobertos por Playwright (claro/escuro, desktop/mobile) e testes de API contra
  um Postgres real.
- Documentação no repo: `README.md`, `HANDOFF.md`, `RUNBOOK.md`,
  `CONTRIBUTING.md`, `DESIGN.md`.
- Seeds: `prisma/seed.ts` (usuário de sistema, caixa, linha de config) e
  `src/seed/seed.ts` (catálogo de exemplo — `npm run seed:demo`).
- **Não existe** (não fabricar em trabalho futuro): cliente real além da própria
  Laçolaria, depoimentos, preço de licença, benchmarks, material de marketing.

## Product Principles

1. **O balcão não pode parar.** Bater venda é o caminho crítico. Recuperação
   automática (bandeja, auto-restart, reload de tela) e transação atômica existem
   por causa disso — nada que atrapalhe a finalização de venda entra.
2. **Estoque é tudo-ou-nada.** Toda operação que mexe em estoque grava por
   inteiro ou não grava.
3. **Simplicidade de loja pequena antes de completude de ERP.** PIN em vez de
   contas, config única, sem burocracia fiscal — decisões deliberadas, não
   lacunas.
4. **Uma loja, vários PCs, sem servidor.** Qualquer PC pode cair sem derrubar os
   outros; o Postgres compartilhado é a única fonte de verdade da loja.
5. **Replicável por loja.** O produto se vende instalando em outra papelaria com
   seu próprio banco — o setup precisa continuar simples o bastante para isso
   (é o que o `RUNBOOK.md` protege).
