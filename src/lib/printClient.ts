// Impressão térmica pelo navegador/app (lado do cliente).
// App instalado: manda a página para o Electron imprimir numa janela oculta,
// direto na impressora salva. Navegador: imprime por um iframe escondido
// (abre o diálogo de impressão).
import type { ReceiptWidth } from "@/lib/thermalPrint"

type ElectronPrintAPI = {
  printHtml?: (html: string, opts?: { width?: ReceiptWidth }) => Promise<{ ok?: boolean; reason?: string }>
}

const electronApi = (): ElectronPrintAPI | undefined =>
  typeof window !== "undefined" ? (window as unknown as { electronAPI?: ElectronPrintAPI }).electronAPI : undefined

export const isElectronPrint = () => typeof electronApi()?.printHtml === "function"

export async function printThermal(html: string, width: ReceiptWidth = "80mm"): Promise<{ ok: boolean; reason?: string }> {
  const api = electronApi()
  if (api?.printHtml) {
    const r = await api.printHtml(html, { width })
    return { ok: Boolean(r?.ok), reason: r?.reason }
  }
  return printInIframe(html)
}

function printInIframe(html: string): Promise<{ ok: boolean; reason?: string }> {
  return new Promise((resolve) => {
    const frame = document.createElement("iframe")
    frame.setAttribute("aria-hidden", "true")
    frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden"
    document.body.appendChild(frame)
    const done = (ok: boolean, reason?: string) => {
      setTimeout(() => frame.remove(), 1000)
      resolve({ ok, reason })
    }
    frame.onload = async () => {
      const w = frame.contentWindow
      if (!w) return done(false, "sem janela de impressão")
      try {
        await w.document.fonts?.ready
        await Promise.all(
          Array.from(w.document.images).map((img) => (img.complete ? null : new Promise((r) => (img.onload = img.onerror = r)))),
        )
        w.focus()
        w.print() // bloqueia até fechar o diálogo
        done(true)
      } catch (e) {
        done(false, e instanceof Error ? e.message : String(e))
      }
    }
    frame.srcdoc = html
  })
}
