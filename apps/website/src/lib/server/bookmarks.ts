import { eq } from "drizzle-orm"

import { bookmarks } from "@easyshell/db/schema"

import { db } from "@/db"

/**
 * Returns bookmarked problem ids
 */
export async function getUserBookmarks(userId: string) {
  const user_bookmarks = (
    await db
      .select({ problemId: bookmarks.problemId })
      .from(bookmarks)
      .where(eq(bookmarks.userId, userId))
  ).map((bookmark) => bookmark.problemId)

  return user_bookmarks
}
