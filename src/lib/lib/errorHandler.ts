import { apiValidationError, apiNotFoundError, apiConflictError, apiBusinessError, apiError, apiUnauthorizedError, apiForbiddenError } from "@/lib/lib/apiResponse"
import type { PrismaClientKnownRequestError, PrismaClientValidationError } from "@prisma/client/runtime/client"


/**
 * Handle Prisma and service errors, converting them to appropriate API responses
 */
export function handleApiError(error: unknown): ReturnType<typeof apiError> {
  // Prisma known error types
  if (error && typeof error === 'object' && 'code' in error) {
    const prismaError = error as PrismaClientKnownRequestError

    switch (prismaError.code) {
      case 'P2002': // Unique constraint violation
        return apiConflictError('A record with these values already exists')
      case 'P2025': // Record not found
        return apiNotFoundError()
      case 'P2003': // Foreign key constraint failed
        return apiConflictError('Cannot perform this operation due to related records')
      default:
        // Other Prisma errors
        return apiError('Database error occurred', 500, 'DATABASE_ERROR')
    }
  }

  // Handle validation errors from services
  if (error && typeof error === 'object' && 'message' in error) {
    const message = String((error as { message: unknown }).message)

    // Auth errors should be checked first (most specific)
    if (message.startsWith('UNAUTHORIZED:')) {
      return apiUnauthorizedError(message.replace('UNAUTHORIZED: ', ''))
    }

    if (message.startsWith('FORBIDDEN:')) {
      return apiForbiddenError(message.replace('FORBIDDEN: ', ''))
    }

    // Not found errors should return 404 not 422
    if (message.includes('not found') || message.includes('Not found')) {
      return apiNotFoundError(message)
    }

    // Common validation error messages
    if (message.includes('required') || message.includes('missing')) {
      return apiValidationError(message)
    }

    if (message.includes('email') && message.includes('format')) {
      return apiValidationError(message)
    }

    if (message.includes('password') && message.includes('length')) {
      return apiValidationError(message)
    }

    if (message.includes('already exists') || message.includes('duplicate')) {
      return apiConflictError(message)
    }

    if (message.includes('stock') && (message.includes('insufficient') || message.includes('availability'))) {
      return apiBusinessError(message)
    }

    if (message.includes('session') && message.includes('open')) {
      return apiBusinessError(message)
    }

    if (message.includes('admin') && (message.includes('last') || message.includes('only'))) {
      return apiBusinessError(message)
    }

    // Default to business error for service validation messages
    return apiBusinessError(message)
  }

  // Unexpected error
  console.error('Unexpected API error:', error)
  return apiError('An unexpected error occurred', 500, 'INTERNAL_ERROR')
}