// Tipos de electron/waAutoLogic.cjs (para os testes em TypeScript).
export type QueueItem = { name: string; dueAt: number; unread?: number }
export declare function pickDelayMs(rand?: () => number): number
export declare function rateOk(sentTimes: number[], now: number, maxPerHour: number): boolean
export declare function chatCooldownOk(lastSentAt: number | undefined, now: number): boolean
export declare function userIdle(lastInputAt: number, now: number): boolean
export declare function syncQueue(queue: Map<string, QueueItem>, chats: Array<{ name: string; unread: number }>, now: number, rand?: () => number): Map<string, QueueItem>
export declare function nextDue(queue: Map<string, QueueItem>, now: number): QueueItem | null
