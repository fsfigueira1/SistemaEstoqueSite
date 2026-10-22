# Fase 4: Atendimento com copiloto (WhatsApp Web) + Orçamentos pedidos

Data: 2026-10-22 · Decisões da dona nesta data. Complementa os designs de 20/10 e 22/10.

## Por que

O WhatsApp da loja é o **WhatsApp Business no número fixo**, usado pelo **WhatsApp Web**. A API oficial da Meta está bloqueada (conta invadida). A dona quer que a IA ajude a responder como atendente e monte o orçamento sozinha, e que cada orçamento pedido fique **salvo com nome e número**, para achar quando a pessoa chegar na loja.

## Decisões

- **Copiloto, não robô:** a IA prepara a resposta e o orçamento; **quem envia é sempre o atendente**. O sistema nunca aperta Enviar, porque responder sozinho pelo WhatsApp Web arrisca bloquear o número.
- **PC do balcão (PDV)** fica com o WhatsApp Web.
- Orçamento **só pelo WhatsApp**. O chat do site continua só com perguntas básicas.
- **Duas partes:**
  - **A (este plano)**: lista de **Orçamentos pedidos** + tela **Atendimento** em **modo colar** (o atendente cola a mensagem do cliente; o copiloto devolve a resposta pronta para copiar ou abrir no WhatsApp). Funciona em qualquer PC, sem risco.
  - **B (plano seguinte)**: WhatsApp Web dentro do sistema (Electron, sessão persistente) com leitura automática da conversa aberta e "Colocar no WhatsApp", que escreve na caixa de mensagem sem enviar. O modo colar continua como reserva.

## Comportamento (parte A)

**Copiloto** (`POST /api/copilot { name, phone, text }`):
1. Classifica a mensagem com as mesmas regras do robô:
   - pedido do site (`#ORC-SITE v1`, por SKU, somando o mesmo SKU; uniforme e item sem SKU ficam "a loja confirma");
   - código de lista salva `#L-XXXX` (só listas ativas);
   - lista livre (casamento com o catálogo; só vira orçamento se ≥1 item casar ou ≥2 linhas tiverem quantidade; item não reconhecido fica "a loja confirma");
   - outra mensagem.
2. Se for orçamento, monta o texto **no servidor** (itens, total, faltas, "a loja confirma", rodapé com retirada na loja e "valores conferidos agora"). **Os preços nunca passam pela IA.** O orçamento é **salvo sozinho** em Orçamentos pedidos (nome, telefone, itens com preço do momento, total).
3. A IA da NVIDIA escreve como atendente:
   - quando é orçamento, só uma **abertura curta** ("Oi, Ana! Segue o orçamento…") que vai antes do texto do orçamento;
   - nas outras mensagens, a **resposta inteira** (horário, endereço, dúvidas), usando só os dados da loja.

   Sem chave da NVIDIA: abertura fixa / resposta "um atendente já vai te responder" + horário e endereço.
4. O telefone entra em Contatos como "não respondeu SIM", se ainda não existir. Isso não muda consentimento de ninguém.
5. A resposta é editável na tela. Ações: "Copiar resposta" e "Abrir no WhatsApp" (link `wa.me` com o texto; quem envia é o atendente).

**Orçamentos pedidos** (tela nova):
- Lista com busca por nome ou telefone, filtro por situação (aberto/separado/retirado/cancelado) e data.
- Detalhe com os itens **com o preço e o estoque de agora** e o preço da época, para comparar.
- "Levar para o PDV" usa o mesmo mecanismo da Lista Escolar (`sendToPdv`) e marca como retirado quando confirmado.
- Mudar a situação.
- A Lista Escolar ganha "Salvar orçamento" (nome + telefone).

**Dados da loja para a IA:** nome, endereço e telefone (já em Configurações) e um campo novo **Horário de funcionamento** (texto livre, com padrão igual ao do site).

## Fora de escopo (A)

- WhatsApp Web dentro do sistema (parte B).
- Ler foto de lista no WhatsApp: o atendente usa a leitura de foto da Lista Escolar.
- Envio automático de qualquer mensagem.
