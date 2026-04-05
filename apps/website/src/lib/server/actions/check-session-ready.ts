"use server"

import { auth } from "@/lib/server/auth"
import { getSessionReadiness } from "@/lib/server/mustang"

export async function checkSessionReady(containerName: string) {
  const user = (await auth())?.user
  if (!user) return { exists: false, running: false, ready: false }

  return getSessionReadiness(containerName)
}
