"use client"

import { useEffect } from "react"
import { RotateCcw, Home } from "lucide-react"
import { simplifyMessage } from "@/lib/friendlyError"

// Tela de erro geral: nome curto do problema + duas saídas claras.
// O detalhe técnico vai só para o console.
export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    // eslint-disable-next-line quality/no-direct-console -- tela de erro do navegador: o detalhe fica no console do app
    console.error(error)
  }, [error])

  const title = simplifyMessage(error?.message)
  const hint =
    title === "Sem conexão"
      ? "Confira a internet. Nada foi perdido."
      : "Tente de novo. Se continuar, reinicie o app."

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-8 text-center shadow-md">
        <img src="/logo.png" alt="" className="mx-auto h-16 w-16 rounded-2xl bg-white object-cover ring-1 ring-black/5" />
        <h1 className="mt-5 font-heading text-2xl font-semibold text-foreground">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{hint}</p>
        <div className="mt-6 grid gap-2">
          <button
            onClick={() => reset()}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 font-medium text-primary-foreground hover:bg-primary/90"
          >
            <RotateCcw className="h-4 w-4" /> Tentar de novo
          </button>
          <a
            href="/dashboard"
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-border px-4 py-2.5 font-medium text-foreground/90 hover:bg-muted"
          >
            <Home className="h-4 w-4" /> Ir para o Painel
          </a>
        </div>
      </div>
    </div>
  )
}
