// Regras do robô de resposta automática do WhatsApp (sem depender do
// Electron, para testar). Testado em src/lib/waAutoLogic.test.ts.
/* global module */
"use strict";

const MIN = 60_000;

/** Atraso antes de responder: sorteado entre 4 e 7 minutos (parece gente, e não chama a atenção do WhatsApp). */
function pickDelayMs(rand) {
  return Math.floor(4 * MIN + (rand || Math.random)() * 3 * MIN);
}

/** Cabe mais uma resposta na última hora? */
function rateOk(sentTimes, now, maxPerHour) {
  return sentTimes.filter((t) => now - t < 60 * MIN).length < maxPerHour;
}

/** A mesma pessoa só recebe outra resposta automática depois de 10 minutos. */
function chatCooldownOk(lastSentAt, now) {
  return lastSentAt === undefined || now - lastSentAt >= 10 * MIN;
}

/** O atendente não mexe no WhatsApp há 90 segundos (o robô não tira a conversa da frente dele). */
function userIdle(lastInputAt, now) {
  return now - lastInputAt >= 90_000;
}

/**
 * Atualiza a fila com a lista de conversas: quem tem mensagem não lida entra
 * (com o atraso sorteado uma vez só); quem ficou sem não lida sai — alguém da
 * loja abriu a conversa antes da hora, então o atendente está cuidando.
 */
function syncQueue(queue, chats, now, rand) {
  const unread = new Map(chats.filter((c) => c.unread > 0).map((c) => [c.name, c.unread]));
  for (const name of [...queue.keys()]) if (!unread.has(name)) queue.delete(name);
  for (const [name, n] of unread) {
    const item = queue.get(name);
    if (item) item.unread = n; // chegou mais mensagem: mantém a hora marcada
    else queue.set(name, { name, unread: n, dueAt: now + pickDelayMs(rand) });
  }
  return queue;
}

/** A conversa da fila que venceu há mais tempo (ou null). */
function nextDue(queue, now) {
  let best = null;
  for (const item of queue.values()) if (item.dueAt <= now && (!best || item.dueAt < best.dueAt)) best = item;
  return best;
}

module.exports = { pickDelayMs, rateOk, chatCooldownOk, userIdle, syncQueue, nextDue };
