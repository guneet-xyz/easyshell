"use server"

import { eq } from "drizzle-orm"

import { lower, users } from "@easyshell/db/schema"

import { db } from "@/db"
import { auth, isUsernameValid } from "@/lib/server/auth"

export async function changeUsername(username: string): Promise<{
  success: boolean
  message: string
}> {
  const user = (await auth())?.user
  if (!user) return { success: false, message: "Not logged in." }

  if (username === user.username)
    return {
      success: false,
      message: "You already have that username.",
    }

  const valid = await isUsernameValid({
    username: username,
    checkUnique: false,
  })

  if (!valid.valid)
    return {
      success: false,
      message: `Invalid Username (${valid.error})`,
    }

  const existing = (
    await db
      .select({ userId: users.id })
      .from(users)
      .where(eq(lower(users.username), username.toLowerCase()))
      .limit(1)
  )[0]?.userId

  if (existing !== undefined && existing !== user.id)
    return {
      success: false,
      message: "Username already taken.",
    }

  await db
    .update(users)
    .set({
      username: username,
    })
    .where(eq(users.id, user.id))

  return {
    success: true,
    message: "Username updated.",
  }
}
