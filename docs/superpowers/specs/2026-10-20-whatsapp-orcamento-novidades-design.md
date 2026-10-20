# WhatsApp da loja: orçamento automático de lista escolar + painel de novidades

Data: 2026-10-20 · Repositórios: `SistemaEstoqueSite` (sistema da loja, Electron) e `LacolariaSite` (site público, Next.js 16)

## 1. Intenção (o porquê)

Na volta às aulas, pais e mães pedem orçamento de lista de material pelo WhatsApp e alguém da loja monta na mão. A loja quer:

1. **Orçamento instantâneo e automático pelo WhatsApp**, a qualquer hora, usando o estoque e os preços reais.
2. **Um site que mostra as listas e os uniformes de cada escola/série**, com um botão que abre o WhatsApp já com o pedido de orçamento escrito.
3. **Uma base de contatos** (quem falou com a loja + clientes do sistema + planilha do Excel) para mandar **novidades digitadas manualmente** a todos.

Sucesso = o cliente aperta o botão no site (ou manda a lista de outra escola), recebe o orçamento certo em segundos, e depois **vai buscar na loja**. A dona digita uma novidade no sistema e ela chega a todos os contatos.

## 2. Objetivos, não-objetivos, anti-objetivos

**Objetivos**
- Listas salvas por **escola + série**, ligadas a produtos do estoque, com orçamento recalculado na hora (preço e estoque atuais).
- Robô do WhatsApp (API oficial da Meta / WhatsApp Cloud API) que responde:
  - escola cadastrada → orçamento da lista salva;
  - outra escola → lê a lista enviada (texto ou foto) e monta o orçamento com a mesma lógica da tela Lista Escolar.
- Coleta automática de contatos de quem conversa com o robô.
- Tela "Novidades" no sistema: digitar mensagem → enviar a todos os contatos ativos; importar contatos de Excel (nome + número); acompanhar entregue/lido/falhou/saiu.
- Site: vitrine por escola com fotos e preços dos uniformes (tamanhos disponíveis) e a lista da série ao lado, com botão "Pedir orçamento no WhatsApp".

**Não-objetivos (agora)**
- Reserva/separação de itens, pagamento online, entrega. O cliente busca na loja.
- Modelo 3D de uniforme (fica para uma fase futura; o layout do site deve deixar espaço para ele no lugar da foto).
- Mensagens agendadas, segmentação de público, múltiplos modelos de mensagem.
- SaaS multi-loja (continua um deployment por loja, como hoje).

**Anti-objetivos (seria fracasso mesmo funcionando)**
- O número da loja ser banido/bloqueado pela Meta (por API não oficial, spam ou falta de "SAIR").
- Site e robô mostrarem listas ou preços diferentes do sistema.
- Orçamento com preço congelado/velho.
- Expor o sistema da loja (as APIs internas) na internet. A autenticação do sistema é um cookie de PIN (`src/proxy.ts`) pensado para rede local; ele **não pode** ser hospedado publicamente.

## 3. Restrições conhecidas

- O sistema é um app Electron nos PCs da loja; não fica ligado 24h. O WhatsApp exige um endpoint HTTPS público sempre no ar → o webhook mora no **site**.
- Banco: um Postgres no Supabase compartilhado pelos PCs (Transaction pooler, porta 6543, plano free ~15 conexões). O site/robô vai usar o mesmo banco; precisa de pool pequeno (serverless) para não esgotar conexões.
- Migrações de schema: `prisma migrate deploy` trava no pooler; aplicar o SQL pelo Supabase SQL Editor ou conexão direta (ver `RUNBOOK.md`).
- Meta / WhatsApp Cloud API:
  - Mensagem livre só dentro da **janela de 24h** após o cliente escrever (respostas do robô cabem aqui; essas conversas de atendimento não são cobradas).
  - Mensagem iniciada pela loja (novidades) **exige modelo (template) aprovado** e é cobrada por mensagem (categoria marketing; ~US$ 0,06 no Brasil, conferir tabela atual).
  - Limite diário de destinatários iniciados pela loja que cresce com a reputação do número → envio em lotes/fila.
  - Webhook validado por `hub.verify_token` (GET) e assinatura `X-Hub-Signature-256` (HMAC SHA-256 com o App Secret) em cada POST.
  - A Meta reenvia eventos → processamento idempotente pelo `id` da mensagem.
- Coexistência: a loja continua usando o app WhatsApp Business no celular no mesmo número (a Meta permite app + API juntos). Atendimento humano acontece pelo celular.
- LGPD: registrar origem e consentimento de cada contato; "SAIR" descadastra para sempre.
- A dona confirmou que os contatos da planilha são clientes que confiam na loja.

## 4. Decisões tomadas

### Com a dona (decisões dela)
- API **oficial** da Meta. Conta Meta Business já criada.
- "Ano" = **série escolar**.
- Listas: a escola publica no site dela; a loja copia, liga os itens aos produtos e **salva**. Orçamento rápido sai da lista salva.
- WhatsApp: para série cadastrada, puxa a lista salva; para outra escola, pesquisa no estoque a lista enviada.
- Depois do orçamento o cliente **busca na loja**.
- Uniformes **já estão cadastrados como produtos no estoque**, com preço e estoque.
- Novidades: digitadas manualmente no sistema e enviadas a **todos** os contatos (coletados pelo robô + clientes + importados do Excel).
- O site **ainda não está publicado** (em desenvolvimento).

### Minhas decisões (Claude), a conferir
- **Hospedagem: Vercel**, projeto `LacolariaSite`. O webhook do WhatsApp e as páginas de escola ficam lá. Domínio da loja aponta para lá quando publicar.
- **Site lê o mesmo Postgres** (Supabase) do sistema, só leitura para vitrine; o robô escreve contatos/mensagens. Credencial do site com **papel de banco restrito** (só as tabelas que precisa), não o usuário dono.
- **Lógica de orçamento compartilhada por cópia**: `src/lib/schoolList.ts` (regras puras, já testadas) é copiado para o site com cabeçalho "cópia de SistemaEstoqueSite — manter em sincronia"; os testes vão junto. (Alternativa descartada: hospedar o sistema na Vercel — expõe as APIs internas.)
- **Botão do site carrega um código**: a mensagem pré-escrita termina com um código curto (ex.: `#L-3A7K`) que identifica a lista salva; o robô usa o código e não precisa adivinhar escola/série pelo texto. Sem código, o robô trata como "outra escola".
- **Leitura de foto pelo robô**: reaproveita o prompt e o modelo de `readListWithClaude` com a chave de IA já guardada em `Settings.aiApiKey`. Sem chave, o robô pede a lista em texto.
- **Consentimento**: quem escreve para a loja vira contato com origem `whatsapp`; na primeira conversa o robô pergunta "Quer receber novidades da Laçolaria por aqui? Responda SIM". Clientes do sistema com telefone e contatos do Excel entram com origem `cliente`/`planilha` (consentimento declarado pela loja). Todo envio de novidade tem "Responda SAIR para não receber mais".
- **Modelo de novidade único**, aprovado na Meta, com texto fixo em volta e variáveis `{nome}` e `{mensagem}`. A tela Novidades só pede o texto do meio.
- **Envio em lotes** por fila no banco + rota agendada (Vercel Cron) que respeita o limite diário; contatos de planilha que nunca receberam vão em lotes menores no primeiro envio.
- **Uniformes ligados a escola** por uma tabela nova (escola ↔ produtos), com fotos por peça; os produtos e o estoque continuam os que já existem. Fotos via Cloudinary (já usado em `src/lib/upload.ts`).
- **Fallback humano**: se o robô não entende ou o casamento de itens tem dúvida, ele responde o que conseguiu, marca os itens incertos e diz que um atendente vai confirmar (a conversa segue pelo celular).
- **Robô cala quando um humano entra**: em coexistência a Meta envia ao webhook as mensagens que a loja manda pelo app do celular (eventos de "echo"). Ao detectar uma, o robô pausa naquela conversa por algumas horas, para não responder por cima do atendente.
- **Robô orça só material na v1**; uniformes aparecem com preço e tamanhos no site. Pedido de uniforme pelo WhatsApp cai no atendimento humano.
- **Mensagens que não são lista** ("que horas abre?", "tem mochila?"): resposta curta com endereço/horário e "um atendente já vai te responder".
- **Estoque com alguns minutos de atraso** é aceitável (os PCs podem estar offline e sincronizar depois, ver `RUNBOOK.md`); o orçamento diz "sujeito à disponibilidade na retirada".

## 5. Como funciona (visão)

```
Site (Vercel)                              Meta / WhatsApp
 ├ /listas/[escola]  ← lê listas/uniformes      │
 ├ botão wa.me  ─────────────────────────────►  │ cliente envia
 └ /api/whatsapp/webhook  ◄──────────────────── │
      ├ valida assinatura, grava mensagem (idempotente)
      ├ upsert contato
      ├ código de lista? → orçamento da lista salva
      ├ senão → lê texto/foto → orçamento pelo catálogo
      └ responde via Graph API ─────────────────►
 └ /api/cron/novidades → envia fila em lotes (template)

Postgres no Supabase  ◄──  Sistema (Electron, PCs da loja)
                            ├ Lista Escolar: salvar lista (escola + série)
                            ├ Escolas & uniformes: ligar produtos + fotos
                            └ Novidades: escrever, importar Excel, enviar, acompanhar
```

## 6. Dados novos (esboço)

- `School` — nome, slug, ativo.
- `SchoolList` — escola, série (texto, ex. "3º ano"), ano letivo, código curto único, texto original da lista, ativo.
- `SchoolListItem` — lista, linha original, quantidade, produto (opcional — item sem produto aparece como "não temos").
- `SchoolUniform` — escola, produto, foto(s), ordem de exibição (tamanhos = produtos distintos já existentes; agrupamento por peça fica com o builder).
- `Contact` — telefone (E.164, único), nome, origem (`whatsapp`|`cliente`|`planilha`), `optInAt`, `optOutAt`, `customerId` opcional. (Separado de `Customer` para não poluir o cadastro do PDV; o builder pode preferir estender `Customer`.)
- `WhatsAppMessage` — id da Meta (único), contato, direção, tipo, corpo, status (enviada/entregue/lida/falhou), timestamps.
- `Broadcast` + `BroadcastRecipient` — texto, criada por, status; por destinatário: status, id da mensagem, erro.
- Configuração do WhatsApp (phone number id, token, app secret, verify token, nome do template): **variáveis de ambiente na Vercel**, nunca no banco do sistema nem no repositório. O sistema Electron só precisa saber disparar o envio (ver §7).

## 7. Partes e responsabilidades

1. **Sistema — listas salvas e escolas**: na tela Lista Escolar, "Salvar como lista da escola" (escolher/criar escola, série, ano letivo); tela para gerenciar listas salvas (editar, desativar, ver código); cadastro de escolas e ligação de uniformes + fotos.
2. **Site: webhook e robô** (`/api/whatsapp/webhook`): verificação, assinatura, idempotência, roteamento (código → lista salva; texto/foto → orçamento livre; SIM/SAIR → consentimento), formatação da resposta (itens, preço, total, em falta, "busque na loja", endereço/horário de `content/site.ts`).
3. **Sistema — tela Novidades**: escrever texto, prévia com o modelo, contagem de destinatários, enviar; importar Excel/CSV (nome + número, normaliza para +55, ignora duplicados/inválidos, mostra resumo antes de gravar); histórico com estatísticas. Enviar = gravar `Broadcast` + destinatários no banco; quem envia de fato é o cron do site (o Electron não precisa da credencial da Meta).
4. **Site — cron de envio + status**: processa a fila em lotes; webhook de status atualiza entregue/lido/falhou.
5. **Site — vitrine**: `/listas` (escolas) e `/listas/[escola]` (séries, lista da série, uniformes com foto/preço/tamanhos em estoque, botão WhatsApp). Segue `DESIGN.md` do site. Espaço reservado para o 3D futuro.

## 8. Ordem de entrega sugerida

1. Dados + listas salvas no sistema (§7.1, sem uniformes).
2. Webhook/robô com orçamento de lista salva e livre (§7.2) — testável com o número de teste da Meta antes do site existir.
3. Novidades: tela + importação + cron + status (§7.3, §7.4) — depende do template aprovado.
4. Escolas/uniformes no sistema + vitrine no site (§7.1 resto, §7.5).

## 9. Passos que só a dona pode fazer

- No Meta Business: criar o app, adicionar o produto WhatsApp, registrar/migrar o número da loja (modo coexistência), gerar token permanente (System User), verificar a empresa.
- Submeter o modelo de novidade para aprovação (texto que o builder vai propor).
- Criar a conta na Vercel e conectar o repositório do site (o site hoje não tem git — precisa virar repositório).
- Colar as credenciais como variáveis de ambiente na Vercel.

## 10. Deixado para o builder

- Formato exato das mensagens do robô (curto, claro, pt-BR, com emoji moderado).
- Escolha da lib de acesso ao banco no site (Prisma com client gerado do mesmo schema, ou `pg`/supabase-js) e como evitar divergência do schema.
- Agrupamento de tamanhos de uniforme na vitrine.
- Limites de taxa do robô, tamanho de lote, tentativas.
- Layout das telas novas no sistema (seguir `DESIGN.md` / `PRODUCT.md`).
