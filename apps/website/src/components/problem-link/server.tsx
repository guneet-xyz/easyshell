import { getAuthSession } from "@/lib/server/auth"
import { getProblemDifficulty, getProblemStatus } from "@/lib/server/problems"

import { ProblemLinkBase } from "."

export async function ProblemLink({
  slug,
  className,
}: {
  slug: string
  className?: string
}) {
  const userId = (await getAuthSession())?.user.id
  const difficulty = await getProblemDifficulty(slug)
  const status = userId ? await getProblemStatus(slug, userId) : undefined

  return (
    <ProblemLinkBase
      slug={slug}
      difficulty={difficulty}
      status={status}
      className={className}
    />
  )
}
