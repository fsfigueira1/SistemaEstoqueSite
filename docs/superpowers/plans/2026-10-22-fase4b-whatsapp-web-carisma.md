# Fase 4B: WhatsApp Web no Atendimento + atendente carismática que aprende — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** No PC do balcão, a tela Atendimento mostra o WhatsApp Web dentro do sistema. "Gerar resposta" lê a conversa aberta (nome, número, últimas mensagens do cliente), monta resposta e orçamento como no modo colar, e "Colocar no WhatsApp" escreve a resposta na caixa de mensagem **sem enviar**. A IA fala como uma atendente **super carismática** (tom editável em Configurações) e **aprende** com as respostas que o atendente aprova ou corrige.

**Architecture:**
- **Electron:** um `WebContentsView` com sessão persistente `persist:whatsapp` carrega `https://web.whatsapp.com` (user agent de Chrome), posicionado sobre um espaço reservado da tela Atendimento. A página informa a posição via IPC.
- **Leitura e escrita no WhatsApp:** feitas pelo processo principal com `webContents.executeJavaScript` de funções puras (`electron/whatsappDom.cjs`). Nenhum preload ou Node entra na página do WhatsApp.
- **Seletores do WhatsApp:** num único objeto, para ajuste rápido quando a página do WhatsApp mudar.
- **Funções DOM:** testadas com `jsdom` sobre uma página simulada (fixture).
- **Aprendizado:**
  - tabela `CopilotExample` (mensagem do cliente → resposta final aprovada);
  - as últimas aprovadas entram no prompt como exemplos de **tom**, sem orçamento e sem preço;
  - `Settings.copilotPersona` guarda o tom de voz.

**Tech Stack:** Electron 43 (`WebContentsView`, `session.fromPartition`), Next.js 16, Prisma, Vitest + jsdom (devDependency nova, só testes), NVIDIA.

**Spec:** `docs/superpowers/specs/2026-10-22-fase4-atendimento-copiloto-design.md` (parte B) + decisões de 22/10: geração só ao clicar; IA "super carismática", que aprende e é a cara da loja no WhatsApp.

## Global Constraints

- **O sistema nunca envia mensagem.** "Colocar no WhatsApp" só cola o texto na caixa; quem aperta Enter é o atendente. Nada de cliques simulados em enviar.
- Nada de Node, preload ou acesso a arquivos na página do WhatsApp. Só `executeJavaScript` de funções puras, e só quando o atendente clica.
- **Preço nunca vem da IA.** Os exemplos de aprendizado guardam a resposta inteira, mas no prompt entra só a parte de conversa: antes do bloco do orçamento, sem linhas com preço.
- **Persona padrão (editável):** carismática, calorosa, chama pelo primeiro nome, entusiasmada com o material, 1–2 emojis, frases curtas, sempre oferece ajuda e convida a passar na loja. Nunca inventa preço, prazo ou estoque.
- **WhatsApp Web só no aplicativo (Electron).** No navegador comum, o modo WhatsApp mostra aviso e o modo colar continua.
- Testes de banco e app só no Postgres local (`lacolaria_utf8`). Não publicar.

## Review Focus

- **Conversa com mensagens do cliente e da loja misturadas:** "Gerar resposta" usa só as mensagens do cliente **depois** da última resposta da loja (ou as últimas 6, se a loja ainda não respondeu). Teste na Task 1: `pega só o que o cliente mandou depois da última resposta da loja`.
- **Contato salvo com nome (sem telefone visível) e conversas que usam id interno (`@lid`) em vez do número:** o telefone fica vazio (o atendente pode digitar) e nada quebra. Teste na Task 1: `sem telefone quando o id não é número`.
- **Nenhuma conversa aberta ou o WhatsApp ainda no QR code:** aviso claro, sem erro. Teste na Task 1: `sem conversa aberta`.
- **Exemplos aprendidos com orçamento e preço:** o prompt recebe só a abertura, sem R$. Teste na Task 3: `exemplo tira orçamento e preço`.
- **Resposta colada na caixa com várias linhas:** as quebras de linha se mantêm. Teste na Task 1: `insere texto com quebras de linha` (verifica o evento de colar).

---

### Task 1: Funções DOM do WhatsApp Web (puras, com jsdom)

**Files:** Create `electron/whatsappDom.cjs`, `src/lib/whatsappDom.test.ts`, `src/lib/__fixtures__/whatsapp-chat.html` (página simulada: `#main` com `header` (título com nome), linhas `div[role=row]` contendo `.message-in` / `.message-out`, texto em `[data-pre-plain-text] span.selectable-text`, `data-id="false_5517999998888@c.us_ABC"` ou `"false_123456789@lid_ABC"`, `footer div[contenteditable=true]`). Modify `package.json` (devDependency `jsdom`, `@types/jsdom`).

**Produces (`electron/whatsappDom.cjs`, CommonJS, sem dependências):**
- `SELECTORS` (objeto único com os seletores)
- `readOpenChat(doc: Document): { ok: true; name: string; phone: string; messages: Array<{ from: "cliente" | "loja"; text: string }> } | { ok: false; reason: "sem-conversa" | "nao-conectado" }`. Telefone sai do `data-id` (`55…@c.us`) ou do título se ele for um número. `@lid` → `""`.
- `customerTurn(messages): string`: textos do cliente depois da última da loja (ou as últimas 6, se a loja não falou), unidos por `\n`.
- `insertIntoCompose(doc: Document, text: string): boolean`: foca a caixa e dispara `paste` com `DataTransfer` `text/plain`. Se não houver `ClipboardEvent`/`DataTransfer` suportado, usa `execCommand('insertText')`. Devolve `false` sem caixa.
- `toScript(fn, ...args): string`: monta o código para `executeJavaScript` (`(${fn})(document, …JSON.stringify(args))`).

- [ ] Testes (`// @vitest-environment jsdom`), falham antes: `lê nome, telefone e mensagens`, `pega só o que o cliente mandou depois da última resposta da loja`, `sem telefone quando o id não é número`, `sem conversa aberta` (página só com a tela de QR → `nao-conectado`; sem `#main` → `sem-conversa`), `insere texto com quebras de linha` (escuta o evento `paste` e confere `text/plain`), `toScript gera código executável` (roda com `new Function` no jsdom). Implementar → PASS. **Commit** `WhatsApp Web: leitura da conversa e caixa de mensagem (funções puras)`.

### Task 2: Electron: WhatsApp dentro da janela

**Files:** Create `electron/whatsapp.cjs`. Modify `electron/main.cjs` (registrar), `electron/preload.cjs` (expor `whatsapp`).

**Produces:**
- `registerWhatsApp(mainWindow)`: cria sob demanda um `WebContentsView` com `session.fromPartition('persist:whatsapp')`, `webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true }` e user agent de Chrome estável. Abre links externos no navegador padrão. Bloqueia `will-navigate` para fora de `web.whatsapp.com`.
- IPC: `wa-show (bounds)`, `wa-hide`, `wa-read-chat` → `readOpenChat`, `wa-insert (text)` → `insertIntoCompose` + foco na view, `wa-reload`. Todos validam os argumentos (bounds numéricos e não negativos; texto ≤ 8000).
- `preload.cjs`: `window.electronAPI.whatsapp = { show, hide, read, insert, reload }`.
- Verificação: `node --check electron/*.cjs`. Teste de unidade da validação de bounds e texto (`electron/whatsapp.cjs` exporta `validBounds`, `validText`) em `src/lib/whatsappIpc.test.ts`. **Commit** `WhatsApp Web: janela embutida no Electron`.

### Task 3: Persona e aprendizado

**Files:** `prisma/schema.prisma` (`Settings.copilotPersona String @default(<texto padrão>)`; model `CopilotExample { id, customerText, aiReply, finalReply, createdAt; @@index([createdAt]) }`), migração `20261022160000_copilot_learning`, `schemaUpgrade.ts`, `tests/utils.ts`. Create `src/lib/copilotStyle.ts` (+ teste), `src/services/copilotExampleService.ts` (+ teste). Modify `src/services/copilotService.ts`.

**Produces:**
- `DEFAULT_PERSONA` (texto pt-BR, ~6 linhas, carismático, conforme Global Constraints)
- `styleSample(finalReply: string): string | null`: corta no início do bloco `Orçamento ` (se houver), remove linhas com `PRICE_RE` e limita a 400 caracteres. Vazio → null.
- `buildPersonaPrompt(persona: string, examples: Array<{ customerText: string; finalReply: string }>): string`: persona + até 6 exemplos ("Cliente: …" / "Você respondeu: …") já passados por `styleSample`.
- `CopilotExampleService.record({ customerText, aiReply, finalReply })`: ignora se `finalReply` está vazio ou é igual ao último gravado. `list(limit = 30)`. `remove(id)`.
- `copilotService`: abertura e resposta comum usam `buildPersonaPrompt(settings.copilotPersona, últimos 6 exemplos)` antes das regras atuais (preço continua filtrado por `PRICE_RE`).
- Rotas: `POST /api/copilot/examples` (só JSON; texto ≤ 8000), `GET /api/copilot/examples`, `DELETE /api/copilot/examples/[id]`.
- [ ] Testes (falham antes): `exemplo tira orçamento e preço`, `prompt traz persona e no máximo 6 exemplos`, `record ignora vazio e repetido`, `copiloto manda persona e exemplos para a IA` (o `ai` falso captura o prompt de sistema). Implementar → PASS. **Commit** `Atendimento: atendente carismática que aprende com as respostas aprovadas`.

### Task 4: Telas

**Files:** Modify `src/app/atendimento/page.tsx` (abas "WhatsApp" | "Colar mensagem"; o padrão é WhatsApp quando `window.electronAPI?.whatsapp` existe). Create `src/components/atendimento/WhatsAppPane.tsx` (espaço reservado; `ResizeObserver` → `whatsapp.show(bounds)`; `hide` ao sair; botão "Recarregar WhatsApp") e `src/components/atendimento/LearnedExamples.tsx` (lista recolhível "O que a IA aprendeu", com excluir). Modify `src/app/configuracoes/page.tsx` → bloco IA (`AiSettings`): campo "Tom de voz do atendimento" (textarea, com "Voltar ao padrão"). Settings API aceita `copilotPersona` (≤ 2000 caracteres).

Comportamento no modo WhatsApp:
- "Gerar resposta" → `whatsapp.read()`. Sem conversa ou não conectado → aviso ("Abra a conversa do cliente no WhatsApp"). Senão, preenche nome, telefone e mensagem (editáveis) e chama `/api/copilot` como hoje.
- "Colocar no WhatsApp" → `whatsapp.insert(reply)` + `POST /api/copilot/examples { customerText, aiReply, finalReply: reply }`. Mensagem: "Pronto — confira e aperte Enter no WhatsApp".
- "Copiar" e "Abrir no WhatsApp" (modo colar) também gravam o exemplo.

- [ ] `tsc` e `eslint` sem erro. Conferir no app (navegador comum): aba WhatsApp mostra o aviso de "só no aplicativo"; o modo colar continua funcionando; copiar grava o exemplo e ele aparece em "O que a IA aprendeu" e no prompt seguinte. Conferir no Electron (`npm run electron:dev` com o Postgres local): o WhatsApp Web abre na área certa e mostra o QR code (não escanear — o teste real é da dona). **Commit** `Atendimento: WhatsApp Web, tom de voz e aprendizado nas telas`.
- [ ] Criar `docs/atendimento-whatsapp-teste.md`: roteiro para a dona testar com o celular da loja (escanear QR, abrir conversa, gerar, colocar, conferir, enviar; o que fazer se a leitura parar).
