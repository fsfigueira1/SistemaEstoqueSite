# Integração site ↔ WhatsApp ↔ sistema: o que mudou no site (para o chat do sistema)

**Para quem é:** o assistente (Claude) que trabalha neste repositório (`SistemaEstoqueSite`), principalmente no **robô do WhatsApp** (`docs/superpowers/plans/2026-10-20-fase2-robo-whatsapp.md`).
**Escrito em:** 21/10/2026, a partir do repositório do site (`C:\dev\lacolaria\LacolariaSite`).
**Objetivo:** o robô e o sistema precisam entender as mensagens que o site já está mandando para o WhatsApp da loja e respeitar os dados do sistema dos quais o site depende.

> Leia junto: `LacolariaSite/docs/formato-mensagem-orcamento.md` (formato da mensagem) e `LacolariaSite/lib/orcamento/model.ts` (o código que gera a mensagem).

---

## 1. O que já está no ar (e muda premissas do plano da fase 2)

| Premissa do plano da fase 2 | Como está hoje |
|---|---|
| "Nada é publicado. Não fazer deploy na Vercel." | O site **está publicado** na Vercel em https://lacolaria.vercel.app (projeto `lacolaria`, conta `fsfigueira1`), a pedido do dono. Publica-se com `vercel deploy --prod` na pasta do site. |
| Task 2 começa com `git init` no site. | O site **ainda não é um repositório git**. A Task 2 continua válida. |
| Testes do site com vitest. | O site já tem testes com **`node --test`** (`npm test`, 58 testes) em `lib/**/*.test.ts` e `content/**/*.test.ts`, com `allowImportingTsExtensions` no `tsconfig`. Se o robô usar vitest, os dois convivem, mas não quebre o `npm test` atual. |
| Vitrine `/listas` com botão `#L-XXXX` só na fase 4. | Já existe uma área **Colégio São José** em `/colegio-sao-jose`, que **não usa** as listas salvas (`SchoolList`). O conteúdo está em `content/colegio-sao-jose.ts`, por enquanto com listas de exemplo. O botão do site manda o carrinho inteiro no formato `#ORC-SITE v1` (seção 2), **não** um código `#L-XXXX`. |
| "Nunca usar o `DATABASE_URL` do `.env` do sistema." | O site tem um script, `scripts/sincronizar-estoque.mjs`, que **lê** esse banco para gerar `content/estoque.json`. Ele só lê, numa transação `BEGIN READ ONLY`, e não altera nada. O dono autorizou e disse que vai trocar a senha do banco. Veja a seção 5, item 4. |
| Chat do site (Claude). | O chat do site está no ar com **NVIDIA NIM** (`nvidia/nemotron-3.5-super-vl-120b-a12b`), não com Claude. Uma regra no firewall da Vercel, "Limite do chat", aceita 30 mensagens por IP a cada 10 min em `POST /api/chat`. Esse chat é separado do robô do WhatsApp. |

O webhook do robô continua planejado para morar **no site** (`app/api/whatsapp/webhook/route.ts`), como diz o plano. Ainda não existe.

---

## 2. O formato `#ORC-SITE v1` (o robô precisa reconhecer)

Na página *Meu orçamento* do site, o pai monta um pedido com uma ou mais séries (filhos) e toca em "Enviar pedido de orçamento pelo WhatsApp". O WhatsApp abre com o texto abaixo, e **o cliente envia como mensagem comum**.

### Exemplo real (gerado pelo site, SKUs do banco atual)

```
Olá! Vim pelo site e quero um orçamento para retirar na loja:

*3º ano · Fundamental*
Material escolar:
- 4x Caderno brochura 96 folhas (capa dura) [SKU 7891027116804]
- 6x Lápis grafite nº 2 [SKU 7908673911759]
- 1x Caixa de lápis de cor 24 cores [SKU 314955]
- 1x Tinta guache 6 cores
Uniforme:
- 1x Camiseta manga cobalto, tamanho 2 [SKU 2000000000022]

*1ª série · Médio*
Uniforme:
- 2x Camiseta manga vinho, tamanho M [SKU 1000002285404]

Obrigado!
#ORC-SITE v1
```

Também pode haver grupos da Educação Infantil, por exemplo `*Infantil 4 · Educação Infantil*`. Esses grupos só têm itens de **Uniforme**, porque no Infantil o material a escola fornece.

### Gramática

1. **Identificação:** a mensagem é do site quando **a última linha não vazia** é exatamente `#ORC-SITE v1`. Faça `trim` antes de comparar, porque o WhatsApp pode acrescentar espaços ou quebras no fim. Se o formato mudar, a versão sobe (`v2`…). Só trate como orçamento do site as versões que você conhece.
2. **Grupo (série):** uma linha `*…*` (texto entre asteriscos) abre um grupo, por exemplo `*3º ano · Fundamental*`. É informativo; serve para a atendente separar por filho.
3. **Seção:** `Material escolar:` e `Uniforme:` são informativas.
4. **Item:** toda linha de item casa com:

   ```
   ^- (\d+)x (.+?)(?: \[SKU ([^\]]+)\])?$
   ```

   - grupo 1: **quantidade** (inteiro ≥ 1; no uniforme, de 1 a 20);
   - grupo 2: **descrição** para leitura humana (no uniforme, termina com `, tamanho X`);
   - grupo 3: **SKU** = `Product.sku` exato, quando existe.
5. **Item sem `[SKU …]`:** o site não achou produto para aquele item. Trate como item que a loja precisa conferir (`nao_temos`/"a loja confirma"), **não** tente casar por texto como se fosse uma lista livre.
6. **Mesmo SKU em grupos diferentes** (dois filhos com o mesmo item): para estoque e total, **some as quantidades**. Para a resposta, você pode manter os grupos.
7. **Outras linhas** (saudação, "Obrigado!", linhas vazias): ignore.
8. **Robustez:** aceite `\r\n`. Ignore linhas que começam com `- ` mas não casam com a regex, sem quebrar; registre num log. O cliente pode ter editado o texto antes de enviar.

### Implementação sugerida (no módulo do robô)

```ts
export type ItemSite = { qtd: number; descricao: string; sku: string | null };
export type GrupoSite = { titulo: string; itens: ItemSite[] };
/** null quando a mensagem não é do site (sem a marca #ORC-SITE v1). */
export function parseOrcamentoSite(texto: string): { versao: 1; grupos: GrupoSite[] } | null;
```

Ordem de decisão no `handleEvent` (Task 4 do plano):
1. `parseOrcamentoSite` ≠ null → **orçamento por SKU** (seção 3);
2. senão, `extractListCode` → lista salva `#L-XXXX`;
3. senão, `looksLikeList`/foto → lista livre;
4. senão, pergunta comum.

O `#ORC-SITE` vem **antes** do `#L-` porque a mensagem do site tem várias linhas com cara de lista, e o `looksLikeList` a pegaria.

**Testes que o robô deve ter** (use o exemplo real acima como fixture):
- `parseOrcamentoSite` lê 2 grupos, 6 itens, e o item "Tinta guache" com `sku = null`;
- texto sem a marca final devolve `null`;
- mensagem com `\r\n` e espaço depois da marca é aceita;
- mensagem do site não cai no caminho de lista livre;
- SKU repetido em dois grupos soma no total.

---

## 3. Como orçar uma mensagem do site

- **Produto:** busque `Product` por `sku` (é `@unique`) com `status = 'ACTIVE'`. Preço e estoque **do momento** (`salePrice`, `stockQuantity`), como manda o plano. O preço nunca vem da mensagem.
- **Reaproveite as regras existentes:** monte linhas `{ qty, product: CatalogProduct | null }` e use `allocate`/`quoteTotals` de `src/lib/schoolList.ts` (ou da cópia `lib/quote/schoolList.ts` no site). Elas já dividem o estoque entre linhas do mesmo produto e contam faltas.
- **SKU não encontrado ou produto inativo:** linha "não temos / a loja confirma", nunca erro.
- **Resposta:** mesmo padrão do orçamento da lista salva: itens, total, faltas e o rodapé obrigatório ("retirada na loja", "valores e disponibilidade conferidos agora, sujeitos a alteração na retirada", endereço vindo de `content/site.ts`).
- **Uniforme:** o plano diz "o robô não orça uniforme na 1ª versão". Com SKU, orçar uniforme fica igual a orçar qualquer produto. **Decisão do dono pendente:** perguntar se o robô já orça uniforme vindo do site ou se manda essas linhas para o atendimento humano. Até lá, o mais seguro é orçar o material e marcar o uniforme como "a loja confirma".

---

## 4. Dados do sistema dos quais o site depende (não quebrar)

O site lê estes dados via `scripts/sincronizar-estoque.mjs` e grava `content/estoque.json`. As regras de busca ficam em `content/estoque-regras.ts`. **Se algo abaixo mudar no sistema, rode o script de novo no site e publique**, senão o site manda SKUs velhos.

1. **`Product.sku` é a chave da integração.** Não troque SKU de produto existente. Se precisar, avise e rode a sincronização.
2. **Categoria `Camisas` e nomes dos uniformes.** O tamanho sai do nome. Padrões atuais (sem acento, sem diferenciar maiúsculas):
   - `Camisa|Camiseta manga curta <Cor> - Tam <X>`, com as cores **Cobalto**, **Marinho**, **Vinho** e **Bic**;
   - `Corsário - Tam <X>`, `Ciclista - Tam <X>`, `Bailarina - Tam <X>` (aceita `-Tam`), `Calça tactel - Tam <X>`;
   - `Calça Moletom - 2 ao 8` e `Jaqueta Moletom - 2 ao 8`: um produto só para os tamanhos 2, 4, 6 e 8.

   Produto novo de uniforme precisa seguir esse padrão para aparecer no site.
3. **Regra das cores (definida pelo dono):**
   - Cobalto: Educação Infantil (Infantil 3, 4, 5) e Fundamental 1 (1º ao 5º);
   - Marinho: Fundamental 2 (6º ao 9º);
   - Vinho: Ensino Médio;
   - Azul Bic (camiseta toda azul): Educação Física, em todas as séries.

   Se o sistema ganhar um cadastro de uniformes por escola (fase 4: `SchoolUniform`), use essa mesma regra.
4. **Material escolar = o produto ATIVO MAIS CARO que corresponde** (regra do dono). Exemplo: "Caneta esferográfica preta" vira a caneta preta mais cara. As categorias consideradas são Escrita, Escolar, Papelaria, Cadernos, Arte, Estojos e Escritório. Mudar preço muda a escolha, por isso o site precisa ressincronizar.
5. **`status = 'ACTIVE'`:** produto inativado some do site na próxima sincronização.

**Pedido para o sistema** (melhoria de segurança): criar um **usuário de banco só-leitura** para o site, com `SELECT` em `"Product"` e `"Category"`, e passar a usar esse usuário no script em vez do `DATABASE_URL` completo do `.env`. Hoje o script lê `SistemaEstoqueSite/.env` e conecta ao Supabase com `ssl: { rejectUnauthorized: false }`.

---

## 5. Pontos em aberto (para o dono decidir)

1. O robô **orça uniforme** quando vem do site (tem SKU), ou manda para o humano? Veja a seção 3.
2. Quando existirem listas salvas (`SchoolList`) do Colégio São José, o site deve trocar o carrinho por `#L-XXXX`, ou manter `#ORC-SITE` (que já traz os itens desmarcados pelo pai)? **Sugestão:** manter `#ORC-SITE`, porque ele reflete exatamente o que o pai escolheu.
3. Trocar a senha do banco e criar o usuário só-leitura do item 4.4.

---

## 6. Arquivos de referência no site (`C:\dev\lacolaria\LacolariaSite`)

| Arquivo | O que é |
|---|---|
| `docs/formato-mensagem-orcamento.md` | Especificação curta do `#ORC-SITE v1` |
| `lib/orcamento/model.ts` | `mensagemWhatsapp()`, `MARCA_FORMATO`, regras do carrinho |
| `lib/orcamento/model.test.ts` | Testes do formato, incluindo a regex de item |
| `content/colegio-sao-jose.ts` | Séries, listas (exemplo), peças de uniforme por série |
| `content/estoque-regras.ts` | Como cada item/peça é achado no banco |
| `content/estoque.json` | SKUs e tamanhos gerados pelo script |
| `scripts/sincronizar-estoque.mjs` | Leitura só-leitura do banco → `estoque.json` |
| `app/api/chat/route.ts` | Chat do site (NVIDIA), separado do robô |
