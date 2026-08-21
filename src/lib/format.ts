import { formatCurrency as formatBrCurrency } from "./dateUtils"

// Format currency (Brazilian Real)
export function formatCurrency(value: number): string {
  return formatBrCurrency(value)
}

// Format currency with custom options
export function formatCurrencyCustom(
  value: number,
  options: {
    currency?: string
    locale?: string
    showSymbol?: boolean
  } = {}
): string {
  const { currency = "BRL", locale = "pt-BR", showSymbol = true } = options
  
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    ...(showSymbol ? {} : { currencyDisplay: "code" })
  }).format(value)
}

// Format percentage
export function formatPercentage(value: number, decimals: number = 2): string {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(value)
}

// Format number with thousands separator
export function formatNumber(value: number, decimals: number = 0): string {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(value)
}

// Format file size
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes"
  
  const k = 1024
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
}

// Truncate text to specified length
export function truncateText(text: string, length: number, suffix: string = "..."): string {
  if (text.length <= length) return text
  return text.slice(0, length > suffix.length ? length - suffix.length : 0) + suffix
}

// Capitalize first letter
export function capitalize(str: string): string {
  if (!str) return str
  return str.charAt(0).toUpperCase() + str.slice(1)
}

// Convert string to title case
export function toTitleCase(str: string): string {
  return str.replace(
    /\w\S*/g,
    (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
  )
}

const formatLib = {
  formatCurrency,
  formatCurrencyCustom,
  formatPercentage,
  formatNumber,
  formatFileSize,
  truncateText,
  capitalize,
  toTitleCase
}

export default formatLib
