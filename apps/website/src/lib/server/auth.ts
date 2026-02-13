import {
  accounts,
  lower,
  sessions,
  users,
  verificationTokens,
} from "@easyshell/db/schema"

import { MagicLink } from "@/components/emails/magic-link"
import { db } from "@/db"
import { env } from "@/env"
import { getResend } from "@/lib/server/resend"

import { DrizzleAdapter } from "@auth/drizzle-adapter"
import { count, eq } from "drizzle-orm"
import { type DefaultSession } from "next-auth"
import NextAuth from "next-auth"
import { type Adapter } from "next-auth/adapters"
import DiscordProvider from "next-auth/providers/discord"
import GithubProvider from "next-auth/providers/github"
import GoogleProvider from "next-auth/providers/google"
import Resend from "next-auth/providers/resend"

// =============================== Helper Utilities ===============================

/**
 * Determine if the username is valid.
 * By default, also checks for uniqueness. Set checkUnique=false to disable this behavior.
 */
export async function isUsernameValid({
  username,
  checkUnique,
}: {
  username: string
  checkUnique: boolean
}): Promise<
  | { valid: true }
  | {
      valid: false
      error: "too-short" | "too-long" | "invalid-characters" | "already-exists"
    }
> {
  if (username.length > 20) return { valid: false, error: "too-long" }
  if (username.length < 3) return { valid: false, error: "too-short" }
  if (!/^[a-zA-Z\d][a-zA-Z\d_-]*[a-zA-Z\d]$/.test(username))
    return { valid: false, error: "invalid-characters" }

  if (checkUnique) {
    const exists = (
      await db
        .select({ userId: users.id })
        .from(users)
        .where(eq(lower(users.username), username.toLowerCase()))
        .limit(1)
    )[0]
    if (exists !== undefined) return { valid: false, error: "already-exists" }
  }

  return { valid: true }
}

export async function isNameValid(
  name: string,
): Promise<{ valid: true } | { valid: false; error: string }> {
  if (name.length === 0) return { valid: false, error: "empty" }
  if (name !== name.trim())
    return { valid: false, error: "leading or trailing whitespace" }
  return { valid: true }
}

/**
 * Generates a valid username from an existing username that might be invalid.
 * It also checks for uniqueness, i.e. if the name already exists, a unique suffix is added.
 */
async function generateValidUsername(username: string): Promise<string> {
  let newUsername = ""
  for (const char of username) {
    if (/[a-zA-Z0-9_-]/.test(char)) {
      newUsername += char
    } else if (char === " ") {
      newUsername += "_"
    } else {
      newUsername += "-"
    }
  }

  let suffix = 0
  const loop_limit = 10
  let loop_iter = 0

  while (true) {
    loop_iter++
    if (loop_iter > loop_limit) {
      throw new Error("loop limit exceeded")
    }
    const newUsernameWithSuffix = newUsername + (suffix > 0 ? `-${suffix}` : "")
    const exists = await isUsernameValid({
      username: newUsernameWithSuffix,
      checkUnique: true,
    })
    if (exists.valid) {
      newUsername = newUsernameWithSuffix
      break
    }

    if (exists.error === "already-exists") {
      suffix++
    } else {
      newUsername = await generateAnonymousName()
      suffix = 0
    }
  }

  return newUsername
}

async function generateAnonymousName(): Promise<string> {
  const suffix =
    (
      await db
        .select({
          count: count(),
        })
        .from(users)
    )[0]!.count + 1
  const name = `user-${suffix}`
  return name
}

/**
 * Attempts to fix missing fields for user. Safe to use on a good user.
 */
async function fixUser(userId: string) {
  const user = (
    await db.select().from(users).where(eq(users.id, userId)).limit(1)
  )[0]!

  let name = user.name ?? user.email.split("@")[0]!
  const validName = await isNameValid(name)
  if (!validName.valid) {
    name = await generateAnonymousName()
  }

  let username = user.username
  const validUsername =
    username !== null &&
    (await isUsernameValid({ username: username, checkUnique: false })).valid
  if (!validUsername) username = await generateValidUsername(name)

  if (username !== user.username || name !== user.name) {
    await db
      .update(users)
      .set({
        name: name,
        username: username,
      })
      .where(eq(users.id, user.id))
  }

  return {
    id: user.id,
    email: user.email,
    name: name,
    username: username!,
    image: user.image ?? undefined,
    joinedAt: user.joinedAt,
  }
}

/**
 * Get user by id. User will be fixed if necessary.
 */
export async function getUserById(userId: string) {
  const user = (
    await db
      .select({
        id: users.id,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)
  )[0]

  if (!user) return null

  const fixedUser = await fixUser(user.id)
  return fixedUser
}

/**
 * Get user by username. User will be fixed if necessary.
 */
export async function getUserByUsername(username: string) {
  const user = (
    await db
      .select({
        id: users.id,
      })
      .from(users)
      .where(eq(lower(users.username), username.toLowerCase()))
      .limit(1)
  )[0]

  if (!user) return null

  const fixedUser = await fixUser(user.id)
  return fixedUser
}

// ================================ Auth Configuration ===============================

declare module "next-auth" {
  interface Session extends DefaultSession {
    user: {
      id: string
      name: string
      username: string
      image?: string
    } & DefaultSession["user"]
  }

  interface User {
    username?: string | null
  }
}

export const { auth, handlers, signIn, signOut } = NextAuth({
  pages: {
    signIn: "/login",
    signOut: "/logout",
    error: "/error/auth",
    verifyRequest: "/verify-request",
  },
  callbacks: {
    session: async (ctx) => {
      const { session } = ctx
      if (
        !session.user ||
        !session.user.name ||
        !session.user.username ||
        !(await isNameValid(session.user.name)).valid ||
        !(
          await isUsernameValid({
            username: session.user.username,
            checkUnique: false,
          })
        ).valid
      ) {
        return {
          ...session,
          user: await fixUser(session.user.id),
        }
      }
      return session
    },
  },
  events: {
    async createUser(event) {
      // TODO: send welcome email
      const { user } = event
      if (!user.id) return
      await fixUser(user.id)
    },
    async updateUser() {
      // TODO: send alert email
    },
    async linkAccount() {
      // TODO: send alert email
    },
  },
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }) as Adapter,
  providers: [
    DiscordProvider({
      clientId: env.DISCORD_CLIENT_ID,
      clientSecret: env.DISCORD_CLIENT_SECRET,
      allowDangerousEmailAccountLinking: true,
    }),
    GithubProvider({
      clientId: env.GITHUB_CLIENT_ID,
      clientSecret: env.GITHUB_CLIENT_SECRET,
      allowDangerousEmailAccountLinking: true,
    }),
    GoogleProvider({
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      allowDangerousEmailAccountLinking: true,
    }),
    Resend({
      async sendVerificationRequest(params) {
        const { identifier, url } = params
        const resend = getResend()
        await resend.emails.send({
          from: "no-reply@easyshell.sh",
          to: identifier,
          subject: `Sign-In to EasyShell`,
          react: MagicLink({ url }),
        })
      },
    }),
  ],
})
