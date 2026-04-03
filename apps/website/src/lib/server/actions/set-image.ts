"use server"

import { encode } from "base64-arraybuffer"
import { count, eq } from "drizzle-orm"

import { images, users } from "@easyshell/db/schema"

import { db } from "@/db"
import { auth } from "@/lib/server/auth"

export async function setUserImage(file: File): Promise<{
  success: boolean
  message: string
}> {
  try {
    if (file.size > 1024 * 1024) {
      return {
        success: false,
        message: "Image size must be less than 1MB",
      }
    }

    const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"]
    if (!allowedTypes.includes(file.type)) {
      return {
        success: false,
        message: "Invalid file type.",
      }
    }

    const userId = (await auth())?.user.id
    if (!userId) return { success: false, message: "Not authenticated." }

    const imageBlob = await file.arrayBuffer()
    const extension = file.name.split(".").pop() ?? "jpg"

    const base64 = encode(imageBlob)

    await db.transaction(async (tx) => {
      const imageCount = (
        await tx.select({ imageCount: count() }).from(images)
      )[0]!.imageCount
      const name = `${imageCount + 1}.${extension}`
      await tx.insert(images).values({
        name,
        base64,
        uploadedBy: userId,
      })

      await tx
        .update(users)
        .set({
          image: `/images/${name}`,
        })
        .where(eq(users.id, userId))
    })

    return {
      success: true,
      message: "Image uploaded successfully.",
    }
  } catch {
    return {
      success: false,
      message: "An unknown error occured.",
    }
  }
}
