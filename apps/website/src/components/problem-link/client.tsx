"use client"

import { useEffect, useState } from "react"

import { getProblemDifficulty } from "@/lib/server/actions/get-problem-difficulty"
import { getProblemStatus } from "@/lib/server/actions/get-problem-status"

import { ProblemLinkBase } from "."

export function ProblemLink({
  slug,
  className,
}: {
  slug: string
  className?: string
}) {
  const [difficulty, setDifficulty] = useState<
    "easy" | "medium" | "hard" | undefined
  >(undefined)
  const [status, setStatus] = useState<"solved" | "attempted" | undefined>(
    undefined,
  )

  useEffect(() => {
    void (async () => {
      setDifficulty(await getProblemDifficulty(slug))
      setStatus(await getProblemStatus(slug))
    })()
  }, [slug])

  return (
    <ProblemLinkBase
      slug={slug}
      difficulty={difficulty}
      status={status}
      className={className}
    />
  )
}
