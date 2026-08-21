import { useSession, signIn, signOut } from "next-auth/react"
import { usePathname, useRouter } from "next/navigation"
import { useEffect } from "react"

export function useAuth() {
  const { data: session, status } = useSession()
  const pathname = usePathname()
  const router = useRouter()

  // Type assertion for session.user.role
  const user = session?.user as {
    id: string
    name: string | null
    email: string | null
    image: string | null
    role: "ADMIN" | "MANAGER" | "USER"
  } | null

  // Redirect to login if not authenticated
  useEffect(() => {
    if (status === "loading") return
    if (status === "unauthenticated") {
      router.push("/auth/signin")
    }
  }, [status, router])

  // Redirect to dashboard if already authenticated
  useEffect(() => {
    if (status === "authenticated" && user) {
      if (pathname === "/auth/signin") {
        router.push("/dashboard")
      }
    }
  }, [status, user, pathname, router])

  return {
    user,
    status,
    signIn: () => signIn("credentials", { redirect: false }),
    signOut: () => signOut({ callbackUrl: "/auth/signin" })
  }
}
