"use server"

import { getProblemDifficulty as _getProblemDifficulty } from "@/lib/server/problems"

export async function getProblemDifficulty(id: string) {
  return await _getProblemDifficulty(id)
}
