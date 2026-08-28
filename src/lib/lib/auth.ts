import NextAuth, { type Session, type User, type DefaultSession } from "next-auth"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { PrismaClient } from "@/generated/prisma/client"
import GithubProvider from "next-auth/providers/github"
import GoogleProvider from "next-auth/providers/google"
import type { JWT } from "next-auth/jwt"

// Extend the NextAuth types to include our custom fields
declare module "next-auth" {
  interface Session {
    user: {
      id: string
      name: string | null
      email: string | null
      image: string | null
      role: "ADMIN" | "MANAGER" | "USER"
    } & DefaultSession["user"]
  }

  interface User {
    id: string
    role?: "ADMIN" | "MANAGER" | "USER"
  }
}

import { prisma } from "./prisma"
// const prisma = new PrismaClient() - REMOVED to use shared instance

export const authOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    GithubProvider({
      clientId: process.env.GITHUB_ID || "",
      clientSecret: process.env.GITHUB_SECRET || "",
    }),
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    }),
  ],
  session: {
    strategy: "jwt" as const,
  },
  callbacks: {
    async session({ session, token }: { session: Session; token: JWT }) {
      if (token) {
        const tokenAsRecord = token as unknown as Record<string, unknown>
        session.user.id = tokenAsRecord.id as string
        session.user.role = tokenAsRecord.role as "ADMIN" | "MANAGER" | "USER"
      }
      return session
    },
    async jwt({ token, user }: { token: JWT; user: User | undefined }) {
      if (user) {
        const userAsRecord = user as unknown as Record<string, unknown>
        token.id = userAsRecord.id as string
        token.role = userAsRecord.role as "ADMIN" | "MANAGER" | "USER"
      }
      return token
    },
  },
  pages: {
    signIn: "/auth/signin",
  },
}

export const auth = NextAuth(authOptions)
