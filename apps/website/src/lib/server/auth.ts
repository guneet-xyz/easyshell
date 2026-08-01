import { lower, users, type User } from "@easyshell/db/schema"

import { db } from "@/db"
import { env } from "@/env"

import { User as NewUser, betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { count, eq } from "drizzle-orm"
import { headers } from "next/headers"

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
async function fixUserBeforeCreation(user: NewUser): Promise<User> {
  let name = user.name ?? user.email.split("@")[0]!
  const validName = await isNameValid(name)
  if (!validName.valid) {
    name = await generateAnonymousName()
  }

  const username = await generateValidUsername(name)

  return {
    ...user,
    name: name,
    username: username!,
    image: user.image ?? null,
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
  return user
}

/**
 * Get user by username. User will be fixed if necessary.
 */
export async function getUserByUsername(username: string) {
  const user = (
    await db
      .select()
      .from(users)
      .where(eq(lower(users.username), username.toLowerCase()))
      .limit(1)
  )[0]

  if (!user) return null

  return user
}

// ================================ Auth Configuration ===============================

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
  }),
  socialProviders: {
    github: {
      clientId: env.GITHUB_CLIENT_ID,
      clientSecret: env.GITHUB_CLIENT_SECRET,
    },
    discord: {
      clientId: env.DISCORD_CLIENT_ID,
      clientSecret: env.DISCORD_CLIENT_SECRET,
    },
    google: {
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
    },
  },
  user: {
    additionalFields: {
      username: {
        type: "string",
        required: true,
        input: false,
      },
    },
  },
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          return { data: await fixUserBeforeCreation(user) }
        },
      },
    },
  },
})

export async function getAuthSession() {
  return auth.api.getSession({
    headers: await headers(),
  })
}
