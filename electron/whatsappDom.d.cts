// Tipos de electron/whatsappDom.cjs (para os testes em TypeScript).
export type ChatMessage = { from: "cliente" | "loja"; text: string; media?: boolean }
export type OpenChat =
  | { ok: true; name: string; phone: string; group: boolean; messages: ChatMessage[] }
  | { ok: false; reason: "sem-conversa" | "nao-conectado" }

export declare const SELECTORS: Record<string, string>
export declare function readOpenChat(doc: Document, S?: Record<string, string>): OpenChat
export declare function customerTurn(messages: ChatMessage[], limit?: number): string
export declare function newMedia(messages: ChatMessage[], limit?: number): boolean
export declare function sameChat(chat: { name: string; phone: string }, expected: { name: string; phone: string }): boolean
export declare function listChats(doc: Document, S?: Record<string, string>): Array<{ name: string; unread: number }>
export declare function openChat(doc: Document, name: string, S?: Record<string, string>): boolean
export declare function expandReadMore(doc: Document, S?: Record<string, string>): number
export declare function insertIntoCompose(doc: Document, text: string, S?: Record<string, string>): boolean
export declare function sendCompose(doc: Document, S?: Record<string, string>): boolean
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export declare function toScript(fn: (...args: any[]) => unknown, ...args: unknown[]): string
