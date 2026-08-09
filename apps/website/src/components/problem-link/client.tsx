"use client"

import { getProblemDifficulty } from "@/lib/server/actions/get-problem-difficulty"
import { getProblemStatus } from "@/lib/server/actions/get-problem-status"

import { ProblemLinkBase } from "."

import { useEffect, useState } from "react"

export function ProblemLink({
  id,
  className,
}: {
  id: string
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
      setDifficulty(await getProblemDifficulty(id))
      setStatus(await getProblemStatus(id))
    })()
  }, [id])

  return (
    <ProblemLinkBase
      id={id}
      difficulty={difficulty}
      status={status}
      className={className}
    />
  )
}
