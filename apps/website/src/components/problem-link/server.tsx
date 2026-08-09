import { getAuthSession } from "@/lib/server/auth"
import { getProblemDifficulty, getProblemStatus } from "@/lib/server/problems"

import { ProblemLinkBase } from "."

export async function ProblemLink({
  id,
  className,
}: {
  id: string
  className?: string
}) {
  const userId = (await getAuthSession())?.user.id
  const difficulty = await getProblemDifficulty(id)
  const status = userId ? await getProblemStatus(id, userId) : undefined

  return (
    <ProblemLinkBase
      id={id}
      difficulty={difficulty}
      status={status}
      className={className}
    />
  )
}
