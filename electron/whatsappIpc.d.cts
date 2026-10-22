// Tipos de electron/whatsappIpc.cjs (para os testes em TypeScript).
export type Bounds = { x: number; y: number; width: number; height: number }
export declare function validBounds(b: unknown): Bounds | null
export declare function validText(t: unknown): string | null
export declare function isWhatsAppUrl(url: string): boolean
export declare function isAppSender(senderUrl: string, appOrigin: string, isMainFrame: boolean): boolean
export declare function allowPermission(permission: string, origin: string): boolean
