"use client"

import { toast } from "sonner"

export function showToast(
  variant: "success" | "error" | "warning" | "info",
  message: string,
  options?: {
    description?: string
    action?: {
      label: string
      onClick: () => void
    }
  }
) {
  switch (variant) {
    case "success":
      toast.success(message, options)
      break
    case "error":
      toast.error(message, options)
      break
    case "warning":
      toast.warning(message, options)
      break
    case "info":
      toast.info(message, options)
      break
  }
}

// Convenience functions
export function toastSuccess(message: string, options?: { description?: string }) {
  toast.success(message, options)
}

export function toastError(message: string, options?: { description?: string }) {
  toast.error(message, options)
}

export function toastWarning(message: string, options?: { description?: string }) {
  toast.warning(message, options)
}

export function toastInfo(message: string, options?: { description?: string }) {
  toast.info(message, options)
}
