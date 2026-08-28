import { NextResponse } from "next/server"

/**
 * Standardized API success response
 */
export function apiSuccess<T>(data: T, status = 200): NextResponse {
  return NextResponse.json(
    {
      success: true,
      data,
    },
    { status }
  )
}

/**
 * Standardized API error response
 */
export function apiError(
  message: string,
  status = 500,
  code?: string
): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error: {
        message,
        ...(code && { code })
      }
    },
    { status }
  )
}

/**
 * Validation error response (400)
 */
export function apiValidationError(message: string): NextResponse {
  return apiError(message, 400, "VALIDATION_ERROR")
}

/**
 * Not found error response (404)
 */
export function apiNotFoundError(message: string = "Resource not found"): NextResponse {
  return apiError(message, 404, "NOT_FOUND")
}

/**
 * Unauthorized error response (401)
 */
export function apiUnauthorizedError(message: string = "Unauthorized"): NextResponse {
  return apiError(message, 401, "UNAUTHORIZED")
}

/**
 * Forbidden error response (403)
 */
export function apiForbiddenError(message: string = "Forbidden"): NextResponse {
  return apiError(message, 403, "FORBIDDEN")
}

/**
 * Conflict error response (409)
 */
export function apiConflictError(message: string): NextResponse {
  return apiError(message, 409, "CONFLICT")
}

/**
 * Business rule violation error response (422)
 */
export function apiBusinessError(message: string): NextResponse {
  return apiError(message, 422, "BUSINESS_RULE_VIOLATION")
}