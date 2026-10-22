# Fase 3: Novidades (envio pelo celular) + ajudante NVIDIA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Duas entregas no sistema da loja:
- uma tela **Novidades** que organiza os contatos (planilha, clientes, manual) e ajuda a mandar a novidade pelo WhatsApp Business do celular;
- um **ajudante com IA da NVIDIA** que responde sobre vendas e estoque e sugere textos. A foto da lista escolar passa a ser lida pela NVIDIA.

**Architecture:** Regras puras em `src/lib/` (contatos, vCard, link do WhatsApp, cliente NVIDIA, contexto do ajudante) com testes Vitest. Banco via services (`contactService`, `broadcastService`, `assistantService`) com testes no Postgres local. Rotas em `src/app/api/**` (POST só JSON, via `isJsonRequest`). Telas `src/app/novidades` e um painel `AssistantChat`. Tabelas novas `Broadcast`/`BroadcastRecipient` e colunas novas em `Settings`, sempre nos três lugares (schema + migração + `schemaUpgrade.ts`).

**Tech Stack:** Next.js 16, Prisma 7 + Postgres, Vitest, NVIDIA NIM (API no formato OpenAI, via `fetch`).

**Spec:** `docs/superpowers/specs/2026-10-22-fase3-novidades-ajudante-design.md` (e o design original `2026-10-20-whatsapp-orcamento-novidades-design.md`)

## Global Constraints

- Não publicar nada (`electron:publish`/`release`), não fazer deploy. A loja segue na versão de teste.
- **Nunca** usar o `DATABASE_URL` do `.env` (Supabase de produção). Testes de banco e app só em Postgres local.
- **Nenhuma chave em arquivo do repositório.** A chave da NVIDIA vem de `Settings.nvidiaApiKey` (cadastrada pela dona) e nunca vai ao navegador: só `nvidiaKeySet`/`nvidiaKeyHint`, como já acontece com `aiApiKey`. Para teste manual, usar variável de ambiente no comando, não arquivo.
- Telefone normalizado com `whatsappNumber` de `src/lib/restock.ts` (55 + DDD + número, só dígitos).
- Toda novidade termina com `Para não receber mais, responda SAIR.`
- "Recebe novidades" = `optInAt IS NOT NULL AND optOutAt IS NULL`. Importar de novo nunca reativa quem saiu.
- O ajudante só lê dados. Responde em pt-BR. Modelo padrão `nvidia/nemotron-3.5-super-vl-120b-a12b`, endpoint `https://integrate.api.nvidia.com/v1/chat/completions`.
- Textos de interface em pt-BR. Telas com `Layout` + `PageHeader`, seguindo o estilo de `src/app/lista-escolar`.

## Review Focus

- **Planilha colada com cabeçalho, sem cabeçalho, com colunas trocadas (telefone antes do nome), com `;`/tab/vírgula e telefones com máscara** ("(17) 99999-8888", "+55 17 ..."): todas devem importar. Teste na Task 1: `parseContacts aceita os formatos do Excel`.
- **Mesmo telefone duas vezes na planilha, ou já cadastrado**: não pode duplicar. Teste na Task 2: `importRows não duplica e não reativa quem saiu`.
- **Contato sem nome com `{nome}` no texto**: não pode sair "Olá, !". Teste na Task 1: `personalize sem nome`.
- **Ajudante sem chave, ou NVIDIA fora do ar/lenta**: mensagem clara, sem tela quebrada. Teste na Task 6: `nvidiaChat erro vira mensagem clara`. Na Task 7: rota sem chave → 400 com texto para a dona.
- **Novidade criada e depois alguém sai**: o envio já criado continua com a lista daquele momento, mas o botão "Abrir no WhatsApp" de quem saiu fica desabilitado com aviso. Teste na Task 2: `destinatário que saiu depois aparece como saiu`.

---

### Task 0: Postgres local de verdade para testar

O pglite caiu várias vezes na fase 1. Usar o `embedded-postgres` (binários do npm), instalado **fora do repositório**, na pasta temporária. Script `startpg.mjs` sobe na porta 54330 com a pasta de dados no scratchpad, cria o banco `lacolaria_test` e roda `prisma migrate deploy`. Isso não é commitado. Se falhar, voltar ao pglite (ruling).

- [ ] Subir, migrar e rodar `npx vitest run src/lib tests/savedListService.test.ts` contra ele → verde.

### Task 1: Regras puras de contatos e envio

**Files:** Create `src/lib/contacts.ts`, `src/lib/contacts.test.ts`

**Interfaces (Produces):**
- `type ContactRow = { name: string; phone: string }` (phone já normalizado)
- `parseContacts(text: string): { rows: ContactRow[]; invalid: Array<{ line: number; raw: string }> }`: usa `parseCsv` de `src/lib/productImport.ts`. Acha o cabeçalho por aliases (nome/cliente; telefone/celular/whatsapp/fone). Sem cabeçalho, detecta a coluna que vira telefone válido com `whatsappNumber` e usa a outra como nome. Remove duplicados por telefone (fica o primeiro com nome).
- `OPT_OUT_FOOTER = "Para não receber mais, responda SAIR."`
- `withFooter(text: string): string`: acrescenta o rodapé com uma linha em branco, sem duplicar se já estiver lá.
- `personalize(text: string, name: string | null): string`: `{nome}` → primeiro nome com inicial maiúscula. Sem nome: remove `{nome}` e arruma o que sobra (`", "`, espaço antes de `!`/`,`).
- `waLink(phone: string, text: string): string` → `https://wa.me/<phone>?text=<encodeURIComponent(text)>`
- `buildVcf(contacts: Array<{ name: string | null; phone: string }>): string`: vCard 3.0, uma entrada por contato, `FN` = nome ou `Cliente <últimos 4>`, `TEL;TYPE=CELL:+<phone>`, linhas com `\r\n`, escapando `,` `;` `\`.

- [ ] **Step 1: testes** (todos falham antes):

```ts
it('parseContacts aceita os formatos do Excel', () => {
  expect(parseContacts('Nome\tTelefone\nAna Souza\t(17) 99999-8888\nBeto\t17 3228-0909').rows).toEqual([
    { name: 'Ana Souza', phone: '5517999998888' }, { name: 'Beto', phone: '551732280909' }])
  expect(parseContacts('celular;cliente\n+55 17 99999-8888;Ana').rows).toEqual([{ name: 'Ana', phone: '5517999998888' }])
  expect(parseContacts('Ana,17999998888\nBeto,17988887777').rows.map((r) => r.phone)).toEqual(['5517999998888', '5517988887777'])
  const r = parseContacts('Ana\t123\nAna\t17999998888\nRepetida\t(17)99999-8888')
  expect(r.rows).toHaveLength(1); expect(r.invalid).toEqual([{ line: 1, raw: 'Ana\t123' }])
})
it('personalize com e sem nome', () => {
  expect(personalize('Olá, {nome}! Chegou caderno.', 'ANA souza')).toBe('Olá, Ana! Chegou caderno.')
  expect(personalize('Olá, {nome}! Chegou caderno.', null)).toBe('Olá! Chegou caderno.')
  expect(personalize('{nome}, chegou caderno', '')).toBe('Chegou caderno')
})
it('withFooter não duplica', () => {
  expect(withFooter('Oi')).toBe('Oi\n\n' + OPT_OUT_FOOTER)
  expect(withFooter(withFooter('Oi'))).toBe('Oi\n\n' + OPT_OUT_FOOTER)
})
it('waLink e buildVcf', () => {
  expect(waLink('5517999998888', 'Oi & tchau')).toBe('https://wa.me/5517999998888?text=Oi%20%26%20tchau')
  const v = buildVcf([{ name: 'Ana; Souza', phone: '5517999998888' }, { name: null, phone: '551732280909' }])
  expect(v).toContain('BEGIN:VCARD\r\nVERSION:3.0\r\nFN:Ana\\; Souza\r\nTEL;TYPE=CELL:+5517999998888\r\nEND:VCARD')
  expect(v).toContain('FN:Cliente 0909')
})
```

- [ ] **Step 2:** `npx vitest run src/lib/contacts.test.ts` → FAIL. **Step 3:** implementar. **Step 4:** PASS. **Step 5: Commit** `Novidades: regras de contatos, vCard e link do WhatsApp`.

### Task 2: Tabelas de envio + services de contatos e novidades

**Files:**
- Modify: `prisma/schema.prisma` (models abaixo + `Contact.recipients BroadcastRecipient[]`)
- Create: `prisma/migrations/20261022120000_broadcasts/migration.sql`
- Modify: `src/lib/schemaUpgrade.ts`, `tests/utils.ts` (apagar `broadcastRecipient`, `broadcast` antes de `whatsAppMessage`)
- Create: `src/services/contactService.ts`, `src/services/broadcastService.ts`
- Test: `tests/contactService.test.ts`, `tests/broadcastService.test.ts`

```prisma
model Broadcast {
  id         String               @id @default(uuid())
  text       String
  createdAt  DateTime             @default(now())
  recipients BroadcastRecipient[]
}

model BroadcastRecipient {
  broadcastId String
  contactId   String
  sentAt      DateTime?
  broadcast   Broadcast @relation(fields: [broadcastId], references: [id], onDelete: Cascade)
  contact     Contact   @relation(fields: [contactId], references: [id], onDelete: Cascade)
  @@id([broadcastId, contactId])
  @@index([contactId])
}
```

**Interfaces (Produces):**
- `ContactService`:
  - `type ContactDTO = { id; name: string | null; phone; source; status: "ativo" | "saiu" | "pendente"; createdAt: string }` (`pendente` = veio do WhatsApp e ainda não disse SIM)
  - `list(): Promise<ContactDTO[]>` (ordem: nome, telefone)
  - `previewImport(rows: ContactRow[]): Promise<{ novos: number; existentes: number }>`
  - `importRows(rows: ContactRow[], source: "planilha" | "manual"): Promise<{ criados: number; atualizados: number }>`: cria com `optInAt = now`. Existente: preenche nome vazio e, se nunca teve `optInAt` e não saiu, põe `optInAt = now`. Nunca mexe em quem tem `optOutAt`.
  - `importCustomers(): Promise<{ criados: number; atualizados: number }>`: `Customer` com telefone válido → `source "cliente"`, `customerId`.
  - `setStatus(id: string, ativo: boolean): Promise<void>`: `ativo=false` → `optOutAt = now`; `ativo=true` → `optOutAt = null`, `optInAt = coalesce(optInAt, now)`.
  - `remove(id: string): Promise<void>`
- `BroadcastService`:
  - `create(text: string): Promise<{ id: string; total: number }>`: texto vazio → erro `"Escreva a mensagem"`. Sem destinatários → `"Nenhum contato recebendo novidades"`. Grava o texto **sem** o rodapé (o rodapé entra na hora de enviar).
  - `list(): Promise<Array<{ id; text; createdAt; total; sent }>>`
  - `get(id): Promise<{ id; text; message: string /* com rodapé */; recipients: Array<{ contactId; name; phone; sentAt: string | null; saiu: boolean }> } | null>`
  - `markSent(id: string, contactId: string, sent: boolean): Promise<void>`

- [ ] **Step 1:** schema + migração + schemaUpgrade + `prisma generate`; `migrate deploy` no Postgres local.
- [ ] **Step 2: testes** (falham antes): `importRows cria com optInAt`, `importRows não duplica e não reativa quem saiu`, `importCustomers liga customerId e ignora telefone inválido`, `setStatus sai e volta`, `create tira foto dos destinatários ativos`, `create sem contatos ativos dá erro claro`, `destinatário que saiu depois aparece como saiu`, `markSent marca e desmarca`.
- [ ] **Step 3:** implementar (`ensureSchema()` no começo de cada método). **Step 4:** testes verdes + `npx tsc --noEmit`. **Step 5: Commit** `Novidades: tabelas e services de contatos e envios`.

### Task 3: Rotas de API de Novidades

**Files:** Create:
- `src/app/api/contacts/route.ts`: GET lista; POST `{ name, phone }` cria manual. Telefone inválido → 400 `"Telefone inválido"`.
- `src/app/api/contacts/import/route.ts`: POST `{ text, commit?: boolean }`. Sem `commit` → `{ rows, invalid, novos, existentes }`. Com `commit` → resultado do import.
- `src/app/api/contacts/import-customers/route.ts`: POST.
- `src/app/api/contacts/[id]/route.ts`: PATCH `{ ativo: boolean }`; DELETE.
- `src/app/api/broadcasts/route.ts`: GET; POST `{ text }`.
- `src/app/api/broadcasts/[id]/route.ts`: GET.
- `src/app/api/broadcasts/[id]/recipients/[contactId]/route.ts`: PATCH `{ sent: boolean }`.
- `src/app/api/broadcasts/[id]/vcf/route.ts`: GET → `text/vcard; charset=utf-8`, `Content-Disposition: attachment; filename="contatos-lacolaria.vcf"` (só destinatários que não saíram).

Padrão das rotas existentes: `{ success, data | error }`, `isJsonRequest` → 415, validação → 400, não achou → 404, resto → 500.

- [ ] Implementar; `npx tsc --noEmit` limpo; **Commit** `Novidades: rotas de API`.

### Task 4: Tela Novidades

**Files:** Create `src/app/novidades/page.tsx`, `src/components/novidades/ContactsTab.tsx`, `src/components/novidades/SendTab.tsx`, `src/components/novidades/ImportDialog.tsx`. Modify `src/components/Layout.tsx` (item "Novidades", ícone `Megaphone`, grupo do balcão, depois de "Lista escolar").

- **Aba Contatos:**
  - contadores (recebem novidades / saíram / pendentes) e busca por nome ou telefone;
  - tabela com origem e situação, com ações "Marcar que saiu" / "Voltar a receber" / Excluir (confirmação);
  - botões "Importar planilha" (diálogo: colar ou escolher CSV → prévia → Importar), "Trazer clientes do sistema" e "Adicionar contato".
- **Aba Enviar:**
  - área de texto com dica de `{nome}`, botão "Sugerir texto com o ajudante" (Task 8) e prévia com o rodapé e `{nome}` = "Ana";
  - "Criar envio para N contatos";
  - abaixo, o envio aberto, com dois blocos:
    1. **Lista de transmissão:** "Baixar contatos (.vcf)", "Copiar mensagem" e o passo a passo curto (importar no celular, criar lista de até 256, colar);
    2. **Um por um:** lista de destinatários com "Abrir no WhatsApp", que abre `waLink` com a mensagem personalizada e marca como enviado, mais checkbox para desmarcar e o progresso "12 de 40".
  - Quem saiu aparece riscado, com o botão desabilitado.
  - Histórico de envios com link para reabrir.

- [ ] Implementar; `npx tsc --noEmit` e `npx eslint src/app/novidades src/components/novidades` sem erro; conferir no app com o Postgres local (Task 0): importar planilha colada, trazer clientes, criar envio, baixar .vcf, abrir link, marcar enviado. **Commit** `Novidades: tela de contatos e envio pelo celular`.

### Task 5: Configurações da NVIDIA

**Files:** Modify `prisma/schema.prisma` (`Settings`: `aiProvider String @default("nvidia")`, `nvidiaApiKey String @default("")`, `nvidiaModel String @default("nvidia/nemotron-3.5-super-vl-120b-a12b")`), a migração da Task 2 (mesmo arquivo, se ainda não aplicada em loja nenhuma; senão `20261022130000_nvidia`), `src/lib/schemaUpgrade.ts`, `src/lib/serverSettings.ts` (`publicSettings` tira `nvidiaApiKey` e expõe `nvidiaKeySet`/`nvidiaKeyHint`), `src/lib/settings.ts` (tipos/padrões + `extra.nvidiaApiKey`/`nvidiaApiKeyClear`), `src/app/api/settings/route.ts` (aceita `aiProvider` ∈ `nvidia|claude`, `nvidiaModel` texto, `nvidiaApiKey`/`nvidiaApiKeyClear` como a chave do Claude), `src/app/configuracoes/page.tsx` (bloco "IA": escolher NVIDIA ou Claude, campo da chave NVIDIA com o final mostrado, salvar/limpar), `src/lib/backupFormat.ts` (o backup **não** leva a chave NVIDIA, igual à do Claude; conferir o teste existente).

- [ ] Teste em `src/lib/backupFormat.test.ts` (ou onde as chaves já são testadas): `nvidiaApiKey não vai para o backup`. FAIL → implementar → PASS. `npx tsc --noEmit`. **Commit** `IA: chave e escolha da NVIDIA em Configurações`.

### Task 6: Cliente NVIDIA + foto da lista pela NVIDIA

**Files:** Create `src/lib/nvidia.ts`, `src/lib/nvidia.test.ts`. Modify `src/services/schoolListService.ts` (`readListWithAI(dataUrl)`: NVIDIA quando `aiProvider === "nvidia"` e houver chave, senão Claude se houver chave, senão erro `"Cadastre a chave da IA em Configurações"`), `src/app/api/school-list/read/route.ts`, e o `aiAvailable` da Lista escolar (`aiKeySet || nvidiaKeySet`).

**Interfaces (Produces):**
- `type NvMessage = { role: "system" | "user" | "assistant"; content: string | Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }> }`
- `nvidiaRequest(opts: { model: string; messages: NvMessage[]; stream: boolean; maxTokens?: number }): object`: corpo com `temperature: 1.0`, `top_p: 0.95`, `max_tokens` (padrão 4096) e `chat_template_kwargs: { enable_thinking: true, low_effort: true }` (mesmos valores do chat do site).
- `nvidiaChat(opts: { apiKey: string; model: string; messages: NvMessage[]; signal?: AbortSignal; fetchImpl?: typeof fetch }): Promise<string>`: sem streaming. Erro HTTP → `"IA da NVIDIA respondeu <status>: <mensagem>"`. Timeout padrão 120 s.
- `nvidiaStream(opts …): AsyncGenerator<string>`: lê o SSE (`data: {…}` / `data: [DONE]`) e devolve só `choices[0].delta.content`.

- [ ] **Testes** (falham antes): `nvidiaRequest monta corpo com imagem`, `nvidiaChat devolve o texto`, `nvidiaChat erro vira mensagem clara`, `nvidiaStream junta os pedaços e ignora [DONE] e linhas vazias`. Implementar → PASS. Teste manual da foto: só se a dona tiver cadastrado a chave (senão registrar que não foi testado de verdade). **Commit** `IA: cliente NVIDIA e leitura da foto da lista pela NVIDIA`.

### Task 7: Ajudante: contexto e rota

**Files:** Create `src/lib/assistantPrompt.ts` (+ teste), `src/services/assistantService.ts` (+ `tests/assistantService.test.ts`), `src/app/api/assistant/route.ts`.

**Interfaces (Produces):**
- `type AssistantContext = { hoje: PeriodSummary; ultimos7: PeriodSummary; anteriores7: PeriodSummary; ultimos30: PeriodSummary; anteriores30: PeriodSummary; maisVendidos30: Array<{ nome; quantidade; total }>; estoqueBaixo: Array<{ nome; estoque; minimo }>; semEstoque: string[]; parados: Array<{ nome; estoque }>; loja: string; agora: string }`, onde `PeriodSummary = { vendas: number; faturamento: number; ticketMedio: number; dinheiro: number; cartao: number; pix: number }`
- `buildAssistantContext(): Promise<AssistantContext>` (service): consultas de leitura (vendas concluídas por período, itens vendidos, produtos `ACTIVE`). Listas limitadas a 15 itens cada.
- `assistantSystemPrompt(ctx: AssistantContext): string` (lib, pura): regras da spec + o contexto em JSON compacto + "você não executa ações". Teste: contém as regras e os números, e o JSON cabe em 12 mil caracteres com 15 itens por lista.
- `POST /api/assistant { messages: Array<{ role: "user" | "assistant"; content: string }> }`: valida (alternância começando e terminando em `user`, máx. 20 mensagens, 2000 caracteres cada). Sem chave NVIDIA → 400 `"Cadastre a chave da NVIDIA em Configurações para usar o ajudante"`. Responde texto em streaming (`nvidiaStream`). Erro no meio → acrescenta "Não consegui terminar a resposta, tente de novo."

- [ ] **Testes** (falham antes): `assistantSystemPrompt traz regras e números`; `buildAssistantContext soma vendas por período e lista estoque baixo/sem estoque/parados` (Postgres local, com vendas criadas pelo `SaleService` como os testes existentes); `rota sem chave dá 400` (chamando o handler com `getServerSettings` sem chave). Implementar → PASS. **Commit** `Ajudante: contexto de vendas/estoque e rota com NVIDIA`.

### Task 8: Ajudante: tela

**Files:** Create `src/components/AssistantChat.tsx`. Modify `src/components/DailyAssistant.tsx` (botão "Perguntar ao ajudante"), `src/components/Layout.tsx` (evento global `openAssistantChat()`, como `openDailyAssistant`), `src/components/novidades/SendTab.tsx` ("Sugerir texto com o ajudante" abre o chat com a pergunta pronta "Sugira um texto curto de novidade para WhatsApp com produtos que temos em estoque" e um botão "Usar este texto" na resposta).

- O painel lateral tem histórico da conversa (só na memória da tela), sugestões ("Quanto vendi essa semana?", "O que está acabando?", "Ideia de novidade com o que tem em estoque"), "pensando…" enquanto espera (pode passar de 1 minuto), mostra o texto chegando aos poucos e tem botão "Nova conversa".
- Sem chave: o aviso com link para Configurações.

- [ ] Implementar; `tsc` e `eslint` limpos. Conferir no app com o Postgres local: sem chave aparece o aviso. Com chave (variável de ambiente só no comando, se a dona autorizar o teste), uma pergunta real. **Commit** `Ajudante: painel de conversa no sistema`.

---

## Próximo plano

Orçamento automático no chat do site (NVIDIA + motor de orçamento do robô, ferramenta para o pedido/lista), coordenando com a outra conversa que cuida do chat do site.
