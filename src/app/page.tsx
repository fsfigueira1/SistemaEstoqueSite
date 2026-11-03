import { redirect } from "next/navigation"

// Quem chega em "/" é mandado pelo src/proxy.ts para a tela inicial do
// perfil (dono → Painel, balcão → PDV) ou para o login. Isto é só reserva.
export default function RootPage() {
  return redirect("/senha")
}
