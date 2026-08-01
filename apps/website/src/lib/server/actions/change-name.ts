"use server"

import { users } from "@easyshell/db/schema"

import { db } from "@/db"
import { getAuthSession, isNameValid } from "@/lib/server/auth"

import { eq } from "drizzle-orm"

export async function changeName(name: string): Promise<{
  success: boolean
  message: string
}> {
  const user = (await getAuthSession())?.user
  if (!user) return { success: false, message: "Not logged in." }

  if (name === user.name)
    return {
      success: false,
      message: "You already have that name.",
    }

  const valid = await isNameValid(name)
  if (!valid.valid)
    return {
      success: false,
      message: valid.error,
    }

  await db
    .update(users)
    .set({
      name: name,
    })
    .where(eq(users.id, user.id))

  return {
    success: true,
    message: "Name updated.",
  }
}
