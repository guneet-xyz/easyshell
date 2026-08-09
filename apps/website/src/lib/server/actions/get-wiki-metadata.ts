"use server"

import { getWikiMetadata as _getWikiMetadata } from "@/lib/server/wiki"

export async function getWikiMetadata(id: string) {
  return await _getWikiMetadata(id)
}
