/* eslint-disable @typescript-eslint/no-require-imports */
// Resposta automática do WhatsApp (só no aplicativo do balcão, só quando
// ligada em Configurações). A cada 20 s olha a lista de conversas; quem tem
// mensagem não lida entra na fila com um atraso sorteado de 4 a 7 min. Na
// hora, abre a conversa, lê, pergunta ao sistema (/api/copilot/auto) se pode
// responder e com qual texto, cola e envia. Cancela se alguém da loja abriu a
// conversa antes; espera o atendente parar de mexer no WhatsApp; respeita o
// limite por hora e o horário configurado. O que não for orçamento ou
// pergunta simples vai para a lista "Precisa de você" do Atendimento.
// Quem decide e escreve é o agente Nemotron (src/services/agentService.ts),
// com a conversa inteira. Com "chamar de volta" ligado, nos intervalos (12 a
// 25 min entre uma e outra, sem resposta na fila) abre a conversa de um
// cliente parado e manda a mensagem que o agente escreveu para ele.
/* global require, module, setInterval, AbortSignal */
"use strict";

const { Notification } = require("electron");
const dom = require("./whatsappDom.cjs");
const L = require("./waAutoLogic.cjs");

const TICK = 20_000;
// só para testes: WA_AUTO_ONLY="Nome,5517999998888" faz o robô atender apenas
// essas conversas (a janela de teste usa o WhatsApp real com o banco de teste)
const ONLY = (process.env.WA_AUTO_ONLY || "").split(",").map((x) => x.trim()).filter(Boolean);
const allowed = (name) =>
  !ONLY.length || ONLY.some((o) => o === name || (o.replace(/\D/g, "").length >= 10 && name.replace(/\D/g, "").endsWith(o.replace(/\D/g, "").slice(-10))));
const STATUS_EVERY = 60_000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const now = () => Date.now();

function createAutoReply({ appOrigin, ensureView, lastInputAt, authCookie }) {
  const state = {
    enabled: false,
    inHours: false,
    maxPerHour: 20,
    statusAt: 0,
    queue: new Map(),
    human: [], // { name, reason, at }
    sent: [], // { name, at, kind }
    sentTimes: [],
    winbackEnabled: false,
    winbackLastAt: 0,
    winbackGap: L.winbackGapMs(),
    winbackBusyUntil: 0,
    lastSentByChat: new Map(),
    handled: new Map(), // nome -> último texto do cliente já tratado
    cancelled: new Set(), // o atendente cancelou: fica de fora até a conversa ser lida
    seen: new Map(), // nome -> não lidas quando o robô olhou (só volta se chegar mensagem nova)
    busy: false,
    lastError: null,
  };

  const api = async (path, body, timeoutMs = 130_000) => {
    const r = await fetch(appOrigin + path, {
      method: body ? "POST" : "GET",
      // crachá do robô (perfil ROBOT, assinado pelo aplicativo) — só abre as rotas dele
      headers: { "content-type": "application/json", cookie: authCookie ? authCookie() : "" },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(timeoutMs),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.success) throw new Error(j.error || `HTTP ${r.status}`);
    return j.data;
  };

  const run = async (fn, ...args) => ensureView().webContents.executeJavaScript(dom.toScript(fn, ...args), true);
  const log = (list, item, max) => {
    list.unshift(item);
    list.length = Math.min(list.length, max);
  };
  /** Passou para a loja sem chegar na IA: lista local + aviso da assistente (todas as telas). */
  const handoff = (name, phone, reason) => {
    log(state.human, { name, reason, at: now() }, 30);
    api("/api/agent/handoff", { name, phone: phone || "", reason }, 15_000).catch(() => {});
  };
  const notify = (title, body) => {
    try {
      if (Notification.isSupported()) new Notification({ title, body }).show();
    } catch {
      /* sem notificação não é erro */
    }
  };

  async function refreshStatus(force) {
    if (!force && now() - state.statusAt < STATUS_EVERY) return;
    try {
      const s = await api("/api/copilot/auto", null, 15_000);
      state.enabled = s.enabled;
      state.inHours = s.inHours;
      state.maxPerHour = s.maxPerHour;
      state.winbackEnabled = Boolean(s.winbackEnabled);
      state.statusAt = now();
    } catch (e) {
      state.lastError = `Sem resposta do sistema: ${e.message}`;
    }
  }

  async function handle(item) {
    state.queue.delete(item.name);
    state.seen.set(item.name, item.unread);
    if (!(await run(dom.openChat, item.name))) return; // saiu da lista visível
    await sleep(2000);
    if (await run(dom.expandReadMore)) await sleep(800);
    const chat = await run(dom.readOpenChat);
    if (!chat || !chat.ok) return;
    // confere que abriu a conversa certa (número sem nome vem como telefone)
    const digits = item.name.replace(/\D/g, "");
    const same = chat.name ? chat.name === item.name : digits.length >= 10 && chat.phone.endsWith(digits.slice(-10));
    if (!same) return;
    if (chat.group) {
      handoff(item.name, chat.phone, "conversa em grupo");
      return;
    }
    const last = chat.messages[chat.messages.length - 1];
    if (!last || last.from !== "cliente") return; // alguém da loja já respondeu
    if (dom.newMedia(chat.messages, item.unread || 1)) {
      handoff(item.name, chat.phone, "mandou foto, áudio ou figurinha — veja a conversa");
      notify("Atendimento: precisa de você", `${item.name} mandou foto ou áudio`);
      return;
    }
    const turn = dom.customerTurn(chat.messages, item.unread || 1);
    if (!turn.trim() || state.handled.get(item.name) === turn) return;
    state.handled.set(item.name, turn);
    if (!L.rateOk(state.sentTimes, now(), state.maxPerHour)) {
      handoff(item.name, chat.phone, `limite de ${state.maxPerHour} respostas por hora`);
      return;
    }
    const d = await api("/api/copilot/auto", { name: chat.name, phone: chat.phone, text: turn, history: L.historyFor(chat.messages) });
    const mark = (status) => (d.eventId ? api(`/api/agent/events/${d.eventId}`, { status }, 15_000).catch(() => {}) : null);
    if (d.action === "human") {
      log(state.human, { name: item.name, reason: d.reason, at: now() }, 30);
      notify("Atendimento: precisa de você", `${item.name}: ${d.reason}`);
      return;
    }
    if (d.action !== "send") return;
    // antes de enviar: a conversa aberta ainda é a mesma e ninguém respondeu
    const again = await run(dom.readOpenChat);
    const lastAgain = again && again.ok ? again.messages[again.messages.length - 1] : null;
    if (!again || !again.ok || !dom.sameChat(again, chat) || !lastAgain || lastAgain.from !== "cliente") {
      await mark("cancelada");
      return;
    }
    await sleep(1500 + Math.random() * 2500); // "digitando"
    if (!(await run(dom.insertIntoCompose, d.reply)) || (await sleep(1200), !(await run(dom.sendCompose)))) {
      await mark("falhou");
      throw new Error("não achei a caixa de mensagem ou o botão Enviar");
    }
    await mark("enviada");
    state.sentTimes.push(now());
    state.lastSentByChat.set(item.name, now());
    log(state.sent, { name: item.name, at: now(), kind: d.intent === "other" ? "pergunta" : d.intent === "product" ? "produto" : "orçamento" }, 50);
  }

  /** Abre a conversa pelo número (recarrega o WhatsApp) e espera a caixa de mensagem. */
  async function openByPhone(phone) {
    ensureView().webContents.loadURL(`https://web.whatsapp.com/send?phone=${encodeURIComponent(phone)}`);
    const tail = phone.slice(-10);
    for (let i = 0; i < 45; i++) {
      await sleep(2000);
      const chat = await run(dom.readOpenChat).catch(() => null);
      if (chat && chat.ok && !chat.group && (!chat.phone || chat.phone.endsWith(tail))) return chat;
    }
    return null;
  }

  /** Chamar de volta: pede ao sistema a próxima mensagem e envia. */
  async function winback() {
    state.winbackLastAt = now();
    state.winbackGap = L.winbackGapMs();
    const next = await api("/api/agent/winback/next", {});
    if (!next) return;
    const mark = (status) => api(`/api/agent/events/${next.eventId}`, { status }, 15_000).catch(() => {});
    if (!L.userIdle(lastInputAt(), now())) return mark("cancelada");
    const chat = await openByPhone(next.phone);
    if (!chat) {
      handoff(next.name, next.phone, "chamar de volta: não consegui abrir a conversa (número sem WhatsApp?)");
      return mark("falhou");
    }
    // o cliente mandou mensagem e ninguém respondeu: não é hora de "chamar de volta"
    const last = chat.messages[chat.messages.length - 1];
    if (last && last.from === "cliente") return mark("cancelada");
    await sleep(2000 + Math.random() * 3000);
    if (!(await run(dom.insertIntoCompose, next.text)) || (await sleep(1200), !(await run(dom.sendCompose)))) {
      await mark("falhou");
      throw new Error("chamar de volta: não achei a caixa de mensagem");
    }
    await mark("enviada");
    log(state.sent, { name: next.name, at: now(), kind: "chamar de volta" }, 50);
  }

  async function tick() {
    if (state.busy) return;
    state.busy = true;
    try {
      await refreshStatus(false);
      if (!state.enabled || !state.inHours) {
        state.queue.clear();
        return;
      }
      const all = await run(dom.listChats);
      if (!Array.isArray(all)) return;
      const chats = all.filter((c) => allowed(c.name));
      for (const c of chats) {
        if (c.unread > 0) continue;
        state.cancelled.delete(c.name);
        state.seen.delete(c.name);
      }
      L.syncQueue(state.queue, chats, now());
      for (const name of state.cancelled) state.queue.delete(name);
      // já olhou e nada mudou (ex.: reação, ou o WhatsApp não marcou como lida): não reabre
      for (const q of [...state.queue.values()]) if (state.seen.get(q.name) === q.unread) state.queue.delete(q.name);
      const item = L.nextDue(state.queue, now());
      if (!item) {
        if (state.winbackEnabled && L.userIdle(lastInputAt(), now()) && L.winbackDue(state.winbackLastAt, state.winbackGap, now(), state.queue)) await winback();
        return;
      }
      if (!L.userIdle(lastInputAt(), now())) return; // tenta de novo na próxima volta
      if (!L.chatCooldownOk(state.lastSentByChat.get(item.name), now())) {
        state.queue.delete(item.name);
        return;
      }
      await handle(item);
      state.lastError = null;
    } catch (e) {
      state.lastError = e && e.message ? e.message : String(e);
    } finally {
      state.busy = false;
    }
  }

  setInterval(tick, TICK);

  return {
    snapshot() {
      return {
        enabled: state.enabled,
        inHours: state.inHours,
        maxPerHour: state.maxPerHour,
        winbackEnabled: state.winbackEnabled,
        winbackInSec: state.winbackEnabled ? Math.max(0, Math.round((state.winbackLastAt + state.winbackGap - now()) / 1000)) : null,
        busy: state.busy,
        queue: [...state.queue.values()].map((q) => ({ name: q.name, inSec: Math.max(0, Math.round((q.dueAt - now()) / 1000)) })),
        human: state.human,
        sent: state.sent,
        lastError: state.lastError,
      };
    },
    cancel(name) {
      state.queue.delete(name);
      state.cancelled.add(name);
    },
    dismiss(name) {
      state.human = state.human.filter((h) => h.name !== name);
    },
    refresh: () => refreshStatus(true),
  };
}

module.exports = { createAutoReply };
