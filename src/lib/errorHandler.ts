import { apiValidationError, apiNotFoundError, apiConflictError, apiBusinessError, apiError, apiUnauthorizedError, apiForbiddenError } from "@/lib/apiResponse"
import { simplifyMessage } from "@/lib/friendlyError"

// Log técnico no servidor. O helper pino (src/lib/logger.ts) depende de
// pino-pretty, que não está instalado — por isso console aqui, num ponto só.
function logTechnical(label: string, detail: unknown) {
  // eslint-disable-next-line quality/no-direct-console -- ver comentário acima
  console.error(label, detail)
}

/**
 * Converte erros do Prisma e dos serviços em respostas de API.
 * O status HTTP continua o mesmo de antes; a mensagem vira um nome curto em
 * português (ver src/lib/friendlyError.ts). O detalhe técnico fica no log.
 */
export function handleApiError(error: unknown): ReturnType<typeof apiError> {
  // Erros conhecidos do Prisma
  if (error && typeof error === 'object' && 'code' in error && typeof (error as { code: unknown }).code === 'string') {
    const code = (error as { code: string }).code
    const raw = `${code} ${String((error as { message?: unknown }).message ?? '')}`
    if (code.startsWith('P')) logTechnical('[erro banco]', raw)

    switch (code) {
      case 'P2002': // unique
        return apiConflictError(simplifyMessage(raw))
      case 'P2025': // não encontrado
        return apiNotFoundError(simplifyMessage(raw))
      case 'P2003': // FK
        return apiConflictError('Em uso — não pode excluir')
      default:
        if (code.startsWith('P')) return apiError(simplifyMessage(raw), 500, 'DATABASE_ERROR')
    }
  }

  // Erros de validação/regra vindos dos serviços
  if (error && typeof error === 'object' && 'message' in error) {
    const message = String((error as { message: unknown }).message)
    const short = simplifyMessage(message.replace(/^(UNAUTHORIZED|FORBIDDEN):\s*/, ''))

    if (message.startsWith('UNAUTHORIZED:')) return apiUnauthorizedError(short)
    if (message.startsWith('FORBIDDEN:')) return apiForbiddenError(short)
    if (/not found|não encontrad/i.test(message)) return apiNotFoundError(short)
    if (/required|missing|obrigat/i.test(message)) return apiValidationError(short)
    if (/email/i.test(message) && /format/i.test(message)) return apiValidationError(short)
    if (/password/i.test(message) && /length|characters/i.test(message)) return apiValidationError(short)
    if (/already exists|duplicate|já existe/i.test(message)) return apiConflictError(short)

    // Demais regras de negócio (estoque, caixa, etc.)
    if (short === 'Algo deu errado') logTechnical('[erro]', message)
    return apiBusinessError(short)
  }

  logTechnical('[erro inesperado]', error)
  return apiError('Algo deu errado', 500, 'INTERNAL_ERROR')
}
