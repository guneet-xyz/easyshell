"use client"

import { useEffect, useState } from "react"

import { getCheckResults } from "@/lib/server/actions/check"
import { getTerminalSession } from "@/lib/server/actions/get-terminal-session"

import { LiveEnvironmentCheck } from "./check"
import { LiveEnvironmentTerminal } from "./terminal"

const SENTINEL_TESTCASE_ID = 1

export function LiveEnvironmentView({
  problemId,
  problemSlug,
}: {
  problemId: number
  problemSlug: string
}) {
  const [sessionId, setSessionId] = useState<number | null>(null)
  const [checkResults, setCheckResults] = useState<
    Awaited<ReturnType<typeof getCheckResults>>
  >([])

  // Fetch session ID and check results on mount
  useEffect(() => {
    void (async () => {
      const [session, results] = await Promise.all([
        getTerminalSession({
          problemId,
          testcaseId: SENTINEL_TESTCASE_ID,
        }),
        getCheckResults({ problemId }),
      ])
      if (session) {
        setSessionId(session.id)
      }
      setCheckResults(results)
    })()
  }, [problemId])

  // Re-fetch session ID when terminal creates one
  useEffect(() => {
    if (sessionId) return
    const interval = setInterval(async () => {
      const session = await getTerminalSession({
        problemId,
        testcaseId: SENTINEL_TESTCASE_ID,
      })
      if (session) {
        setSessionId(session.id)
        clearInterval(interval)
      }
    }, 2000)
    return () => clearInterval(interval)
  }, [problemId, sessionId])

  const containerName = sessionId
    ? `easyshell-${problemSlug}-${SENTINEL_TESTCASE_ID}-session-${sessionId}`
    : null

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="min-h-0 flex-1">
        <LiveEnvironmentTerminal
          problemId={problemId}
          problemSlug={problemSlug}
        />
      </div>
      <div className="flex-shrink-0">
        <LiveEnvironmentCheck
          problemId={problemId}
          problemSlug={problemSlug}
          sessionId={sessionId}
          containerName={containerName}
          initialResults={checkResults}
        />
      </div>
    </div>
  )
}
