# Fase 3: Novidades (sem API da Meta) + ajudante com IA da NVIDIA

Data: 2026-10-22 · Complementa `2026-10-20-whatsapp-orcamento-novidades-design.md`

## Por que mudou

A conta da dona na Meta foi bloqueada depois de uma invasão. Sem a API oficial, o WhatsApp não pode ser automatizado com segurança. APIs não oficiais arriscam banir o número da loja, e a dona escolheu não usar. A NVIDIA (que já roda o chat do site) é uma IA de texto e **não** envia WhatsApp. Ela entra como cérebro do ajudante do sistema e da leitura de foto.

Decisões da dona (22/10/2026):
- **Novidades:** o painel organiza contatos e consentimento e **ajuda a enviar pelo WhatsApp Business do celular**: lista de transmissão (arquivo .vcf de contatos + mensagem copiada) ou um por um (links prontos). Quando a Meta voltar, a mesma tela ganha o envio automático.
- **Orçamento:** só pelo WhatsApp. ~~Chat do site com orçamento~~: **cancelado pela dona em 22/10/2026**. O chat do site responde só perguntas básicas. Enquanto a API da Meta não volta, o orçamento sai pela tela Lista Escolar do sistema (botão WhatsApp). O robô da fase 2 fica pronto e parado até a Meta liberar.
- **Ajudante com IA no sistema (NVIDIA):** responde sobre **relatórios e vendas**, **estoque**, e sugere **ideias e textos** (ex.: texto de novidade com o que tem em estoque). Não cobre "como usar o sistema". **Só lê** dados, nunca altera.
- **Foto da lista escolar:** passa a ser lida pela **NVIDIA** (o modelo do site lê imagens). O Claude continua como opção em Configurações.
- A **chave da NVIDIA** é cadastrada pela dona em Configurações (fica em `Settings`, no banco, como a do Claude), para valer nos 3 PCs. Ninguém grava chave em arquivo do repositório.

## Novidades: comportamento

- **Contatos** (tabela `Contact`, fase 2):
  - lista com nome, telefone, origem (`whatsapp`/`cliente`/`planilha`/`manual`) e situação: *recebe novidades* = `optInAt` preenchido e `optOutAt` vazio; *saiu* = `optOutAt` preenchido.
  - Importar planilha: colar as colunas do Excel (nome + telefone) ou escolher CSV. Prévia com novos, já existentes e inválidos antes de gravar. Telefone normalizado para `55DDDNÚMERO` (regra de `whatsappNumber`). Quem vem da planilha entra com `optInAt` = agora (consentimento declarado pela dona).
  - Trazer clientes do sistema (`Customer.phone`), com origem `cliente` e `optInAt` = agora, ligando `customerId`.
  - Adicionar à mão (origem `manual`, recebe novidades). Marcar "saiu" e "voltar a receber". Excluir.
  - Importar de novo **não** reativa quem saiu.
- **Enviar novidade:**
  - Texto livre. O rodapé "Para não receber mais, responda SAIR." é acrescentado sempre. `{nome}` no texto vira o primeiro nome do contato (ou some, se não houver nome).
  - Criar o envio grava `Broadcast` + `BroadcastRecipient` com uma **foto dos destinatários** do momento (quem recebe novidades).
  - Lista de transmissão: baixar `.vcf` dos destinatários e copiar a mensagem. Explicar o limite de 256 por lista e que só recebe quem tem o número da loja salvo.
  - Um por um: botão "Abrir no WhatsApp" (`https://wa.me/<número>?text=<mensagem personalizada>`) que marca o destinatário como enviado. Desmarcar também é possível. Mostra o progresso.
  - Histórico: data, começo do texto, enviados/total.
  - Botão "Sugerir texto com o ajudante" (usa o ajudante abaixo).

## Ajudante: comportamento

- Chat aberto pela mascote/"Resumo do dia" (botão "Perguntar ao ajudante") e pela tela Novidades.
- A cada pergunta, o servidor monta um **contexto** com dados reais e manda à NVIDIA junto com regras. Dados: vendas de hoje, dos últimos 7 e 30 dias (total, nº de vendas, ticket, por forma de pagamento), comparação com o período anterior, mais vendidos em 30 dias, estoque baixo, sem estoque e produtos parados (com estoque e sem venda em 60 dias).
- Regras: responder em pt-BR, curto; usar **só** os números do contexto e dizer quando não tiver o dado; nunca prometer ação (não altera nada); em ideias/textos de promoção, sugerir só produtos com estoque.
- Sem chave da NVIDIA: o botão aparece com aviso para cadastrar a chave em Configurações.
- Modelo padrão: `nvidia/nemotron-3.5-super-vl-120b-a12b` (o mesmo do site), endpoint `https://integrate.api.nvidia.com/v1/chat/completions` (formato OpenAI). A resposta vem em streaming, porque o endpoint gratuito pode levar mais de 1 minuto.

## Fora de escopo

- Envio automático de WhatsApp (espera a Meta).
- Fase 4 (vitrine de uniformes): a dona achou irrelevante.
- Ajudante que altera dados ou explica telas do sistema.
