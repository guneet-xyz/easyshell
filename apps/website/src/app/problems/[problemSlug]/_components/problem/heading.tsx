import { AlternativeProblemStatus } from "@/components/problem-status"
import { auth } from "@/lib/server/auth"
import {
  getProblemDifficulty,
  getProblemInfo,
  getProblemStatus,
} from "@/lib/server/problems"
import { isProblemBookmarked } from "@/lib/server/queries"
import { cn } from "@/lib/utils"

import { ProblemBookmark } from "./bookmark"

export async function ProblemHeading({ slug }: { slug: string }) {
  const session = await auth()
  const user = session?.user
  const { id, title, description } = await getProblemInfo(slug)
  const isBookmarked = user
    ? await isProblemBookmarked({ userId: user.id, problemId: id })
    : false
  const difficulty = await getProblemDifficulty(slug)
  const status = user ? await getProblemStatus(slug, user.id) : undefined
  return (
    <div
      className={cn(
        "mx-2 rounded-t-md rounded-b-xl border-2 border-black bg-neutral-100 px-4 py-2 shadow-sm dark:bg-neutral-950 dark:text-neutral-200",
        {
          "bg-linear-to-b from-emerald-100 via-emerald-50 via-10% to-neutral-100 dark:from-emerald-500/20 dark:via-emerald-300/10 dark:to-neutral-900":
            difficulty === "easy",
          "bg-linear-to-b from-orange-100 via-orange-50 via-10% to-neutral-100 dark:from-orange-500/20 dark:via-orange-300/10 dark:to-neutral-900":
            difficulty === "medium",
          "bg-linear-to-b from-rose-100 via-rose-50 via-10% to-neutral-100 dark:from-rose-500/20 dark:via-rose-300/10 dark:to-neutral-900":
            difficulty === "hard",
        },
      )}
    >
      <div className="flex items-center gap-4">
        <p className="text-6xl font-black">#{id}</p>
        <div className="flex grow flex-col">
          <h1 className="text-xl font-bold">{title}</h1>
          <p className="font-mono text-sm text-neutral-500">{slug}</p>
        </div>
        <div className="flex items-center">
          <AlternativeProblemStatus
            status={status}
            showNotAttempted
            showTooltip
          />
          <ProblemBookmark isBookmarked={isBookmarked} problemId={id} />
        </div>
      </div>
      <p className="px-4 text-center italic">{description}</p>
    </div>
  )
}
