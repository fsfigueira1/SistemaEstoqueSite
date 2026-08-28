/**
 * Validate and normalize pagination parameters
 */
export function validatePaginationParams(
  pageParam: string | null,
  limitParam: string | null
): { page: number; limit: number } {
  const page = Math.max(1, parseInt(pageParam || "1", 10))
  const limit = Math.max(1, Math.min(100, parseInt(limitParam || "10", 10))) // Cap at 100

  return { page, limit }
}

/**
 * Calculate pagination metadata
 */
export function calculatePaginationInfo(
  total: number,
  page: number,
  limit: number
) {
  const totalPages = Math.ceil(total / limit)
  const hasNextPage = page < totalPages
  const hasPrevPage = page > 1

  return {
    total,
    page,
    limit,
    totalPages,
    hasNextPage,
    hasPrevPage
  }
}