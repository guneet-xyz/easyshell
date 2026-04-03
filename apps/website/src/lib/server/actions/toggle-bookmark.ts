"use server"

import { and, eq } from "drizzle-orm"

import { bookmarks } from "@easyshell/db/schema"

import { db } from "@/db"
import { auth } from "@/lib/server/auth"
import { isProblemBookmarked } from "@/lib/server/queries"

export async function toggleBookmark(problemId: number): Promise<{
  newBookmarkState: boolean
} | null> {
  const userId = (await auth())?.user.id
  if (!userId) return null
  const isBookmarked = await isProblemBookmarked({ problemId, userId })
  if (isBookmarked) {
    await db
      .delete(bookmarks)
      .where(
        and(eq(bookmarks.problemId, problemId), eq(bookmarks.userId, userId)),
      )
    return { newBookmarkState: false }
  }

  await db.insert(bookmarks).values({ problemId, userId })
  return { newBookmarkState: true }
}
