// Tipos de electron/whatsappDom.cjs (para os testes em TypeScript).
export type ChatMessage = { from: "cliente" | "loja"; text: string }
export type OpenChat =
  | { ok: true; name: string; phone: string; messages: ChatMessage[] }
  | { ok: false; reason: "sem-conversa" | "nao-conectado" }

export declare const SELECTORS: Record<string, string>
export declare function readOpenChat(doc: Document, S?: Record<string, string>): OpenChat
export declare function customerTurn(messages: ChatMessage[]): string
export declare function sameChat(chat: { name: string; phone: string }, expected: { name: string; phone: string }): boolean
export declare function insertIntoCompose(doc: Document, text: string, S?: Record<string, string>): boolean
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export declare function toScript(fn: (...args: any[]) => unknown, ...args: unknown[]): string
