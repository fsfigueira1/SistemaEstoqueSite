import { format, formatRelative, parseISO, isToday, isYesterday, isThisWeek } from "date-fns"
import { ptBR } from "date-fns/locale"

// Format date for display
export function formatDate(date: Date | string, formatStr: string = "dd/MM/yyyy"): string {
  const dateObj = typeof date === "string" ? parseISO(date) : date
  return format(dateObj, formatStr, { locale: ptBR })
}

// Format date and time
export function formatDateTime(date: Date | string): string {
  const dateObj = typeof date === "string" ? parseISO(date) : date
  return format(dateObj, "dd/MM/yyyy HH:mm:ss", { locale: ptBR })
}

// Format relative time (e.g., "2 hours ago")
export function formatRelativeTime(date: Date | string): string {
  const dateObj = typeof date === "string" ? parseISO(date) : date
  return formatRelative(dateObj, new Date(), { locale: ptBR })
}

// Check if date is today
export function isTodayDate(date: Date | string): boolean {
  return isToday(typeof date === "string" ? parseISO(date) : date)
}

// Check if date is yesterday
export function isYesterdayDate(date: Date | string): boolean {
  return isYesterday(typeof date === "string" ? parseISO(date) : date)
}

// Check if date is within the current week
export function isThisWeekDate(date: Date | string): boolean {
  return isThisWeek(typeof date === "string" ? parseISO(date) : date)
}

// Format currency (Brazilian Real)
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL"
  }).format(value)
}

// Format percentage
export function formatPercentage(value: number, decimals: number = 2): string {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(value)
}
