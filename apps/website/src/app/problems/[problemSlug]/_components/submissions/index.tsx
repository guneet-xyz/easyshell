"use client"

import type { getUserSubmissions } from "@/lib/server/queries"

import { PastSubmissions } from "./past-submissions"
import { Submission } from "./submission"
import { SubmitPrompt } from "./submit-prompt"

import dynamic from "next/dynamic"
import { useSearchParams } from "next/navigation"
import { Suspense } from "react"

const PromptSettingsContextProvider = dynamic(
  () =>
    import("@/app/settings/_components/prompt-settings").then(
      (mod) => mod.PromptSettingsContextProvider,
    ),
  { ssr: false },
)

export function Submissions({
  problemId,
  problemSlug,
  pastSubmissions,
}: {
  problemId: number
  problemSlug: string
  pastSubmissions: Awaited<ReturnType<typeof getUserSubmissions>>
}) {
  const searchParams = useSearchParams()

  const _submission = parseInt(searchParams.get("submission") ?? "")
  const submission = isNaN(_submission) ? null : _submission

  if (submission === null)
    return (
      <Suspense fallback={<div>Loading</div>}>
        <div className="flex h-full flex-col gap-4">
          <PromptSettingsContextProvider>
            <SubmitPrompt problemId={problemId} problemSlug={problemSlug} />
          </PromptSettingsContextProvider>
          <PastSubmissions
            problemSlug={problemSlug}
            pastSubmissions={pastSubmissions}
          />
        </div>
      </Suspense>
    )

  return (
    <Suspense fallback={<div>Loading</div>}>
      <Submission submissionId={submission} />
    </Suspense>
  )
}
