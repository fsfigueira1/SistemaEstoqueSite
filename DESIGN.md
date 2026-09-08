# DESIGN.md — Laçolaria

Mundo visual do sistema de gestão / PDV da papelaria **Laçolaria**.
Modo: **Operate** (o operador cumpre uma tarefa; expressão nunca atrapalha task/estado).
Documentado a partir do código construído.

## Tese

Um balcão de papelaria fina: o **azul Tiffany** é a cor de trabalho da tela
(não um respingo de acento), neutros de papel quente, títulos com voz própria.
Recusa o dashboard SaaS cinza e o verde esmeralda genérico da versão anterior.

## Cor

Estratégia: **Committed** — o Tiffany carrega ~30–50% da superfície (rail ativo,
botões primários, foco, links, faixa de indicadores, blocos de total).

Tokens em `src/app/globals.css` (`:root` claro, `.dark` escuro), OKLCH:

| Papel | Claro | Escuro |
|---|---|---|
| `--primary` | `oklch(0.72 0.118 190)` (≈ #0ABAB5) | `oklch(0.8 0.13 187)` |
| `--primary-foreground` | tinta quase-preta `oklch(0.24 0.03 210)` | idem escuro |
| `--background` | papel quente `oklch(0.985 0.005 180)` | tinta-teal `oklch(0.19 0.018 212)` |
| `--card` | branco `oklch(1 0.001 180)` | `oklch(0.228 0.02 210)` |
| `--muted-foreground` | `oklch(0.47 0.015 205)` | `oklch(0.72 0.02 190)` |
| `--accent-soft` | tinta Tiffany 3% | tinta Tiffany escura |

Botão primário = fundo Tiffany + **texto tinta** (estilo casa Tiffany: preto no azul).
Neutros têm leve viés teal/quente — nunca `oklch(x 0 0)` puro.

Semânticos: `--success` (verde), `--warning` (âmbar), `--danger` (vermelho), cada um
com `-foreground`. Pílulas de status: classes `.pill` + `.pill-ok/-warn/-danger/-muted`.

## Tipografia

- **Bricolage Grotesque** (500/600/700) — wordmark, títulos de página (`h1`,`h2`),
  linha "TOTAL", valores-chave. Voz de placa de vitrine, contemporânea.
- **Inter** (`--font-sans`) — todo o corpo, tabelas, formulários.
- `tabular-nums` em valores monetários e contagens.

## Forma

- Raio base `0.75rem`; cards `rounded-xl`/`2xl`.
- Sombras reais com offset + blur (`--shadow-sm`…`--shadow-lg`); dark separa mais por borda.
- Foco: anel Tiffany (`--ring`) global em `:focus-visible` + `focus:ring-2` nos inputs.
- Superfícies do navegador tematizadas: `::selection`, `::placeholder`, scrollbar.

## Shell (`src/components/Layout.tsx`)

Rail claro/paper de 60 (`w-60`), wordmark "Laçolaria" + selo "L" Tiffany, item ativo
com `bg-accent-soft` + ponto Tiffany. Toggle de tema (`next-themes`, classe `dark`)
no rodapé. Header com hambúrguer só no mobile; rail vira drawer < `lg`.

## Momentos de assinatura

- **PDV**: bloco de totais como soma de recibo (borda Tiffany, "TOTAL" grande em
  Bricolage Tiffany); "Finalizar Venda" é o único botão grande, Tiffany sólido.
  Indicador "Sistema online" com ponto pulsante. Régua Tiffany sob o `h1`.
- **Painel**: faixa "do dia" (faturamento / vendas / ticket) num painel Tiffany
  dividido em 3, antes da grade de indicadores secundários.

## Risco assumido

A grade de KPIs do Painel ainda é próxima do template "número grande + rótulo";
mitigada pela faixa do dia e pelo ritmo das seções, não eliminada. Aceitável em
modo Operate, onde a grade de indicadores é expectativa nativa de um painel de loja.

## Verificação (rodada única + 1 confirmação)

`tsc` 0 · detector impeccable `[]` · Playwright claro+escuro, desktop+mobile,
6 telas principais, 0 erros de console. Revisão de acabamento feita inline nesta
thread (subagente `impeccable-finish-reviewer` não acionado — sessão longa e
atendida); recomendável rodar `/impeccable polish` numa próxima sessão.
