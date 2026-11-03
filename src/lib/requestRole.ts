// Perfil de quem fez o pedido, numa rota da API. Quem confere o crachá é o
// src/proxy.ts, que repassa o perfil no cabeçalho x-erp-role (e apaga
// qualquer x-erp-role que tenha vindo de fora). Sem o cabeçalho, vale o menor
// acesso (balcão).
import { headers } from "next/headers"
import type { Role } from "@/lib/authToken"

export const ROLE_HEADER = "x-erp-role"

export async function requestRole(): Promise<Role> {
  let r: string | null = null
  try {
    r = (await headers()).get(ROLE_HEADER)
  } catch {
    // fora de um pedido (ex.: chamada direta em teste): menor acesso
  }
  return r === "OWNER" || r === "ROBOT" ? r : "EMPLOYEE"
}
