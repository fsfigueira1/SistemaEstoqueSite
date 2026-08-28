import pino from "pino"

// Create logger instance
const logger = pino({
  level: process.env.NODE_ENV === "production" ? "info" : "debug",
  transport: process.env.NODE_ENV !== "production" 
    ? {
        target: "pino-pretty",
        options: {
          colorize: true
        }
      }
    : undefined,
  // Remove sensitive data from logs
  redact: {
    paths: ["password", "token", "authorization"],
    remove: true
  }
})

export default logger

// Helper functions for logging different types of events
export function logInfo(message: string, meta?: Record<string, unknown>) {
  logger.info({ ...meta }, message)
}

export function logError(message: string, error?: Error, meta?: Record<string, unknown>) {
  logger.error({ ...meta, error: error?.message || error }, message)
}

export function logWarn(message: string, meta?: Record<string, unknown>) {
  logger.warn({ ...meta }, message)
}

export function logDebug(message: string, meta?: Record<string, unknown>) {
  logger.debug({ ...meta }, message)
}

// Audit logging function
export function logAudit(
  action: string,
  userId: string,
  details: Record<string, unknown>,
  req?: Request
) {
  const auditData = {
    timestamp: new Date().toISOString(),
    userId,
    action,
    details,
    ip: req?.headers.get("x-forwarded-for") || req?.headers.get("x-real-ip") || "unknown",
    userAgent: req?.headers.get("user-agent") || "unknown"
  }
  
  logger.info({ ...auditData }, `AUDIT: ${action}`)
}
