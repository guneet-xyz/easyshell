"use client"

import moment from "moment"
import { useRouter } from "next/navigation"
import { useCallback, useState } from "react"
import { ImSpinner3 } from "react-icons/im"

import { getCheckResults, runCheck } from "@/lib/server/actions/check"
import { cn } from "@/lib/utils"

type CheckResultItem = {
  id: number
  score: number
  total: number
  passed: boolean
  output: string
  createdAt: Date
}

export function LiveEnvironmentCheck({
  problemId,
  problemSlug,
  sessionId,
  containerName,
  initialResults,
}: {
  problemId: number
  problemSlug: string
  sessionId: number | null
  containerName: string | null
  initialResults: CheckResultItem[]
}) {
  const [checking, setChecking] = useState(false)
  const [results, setResults] = useState<CheckResultItem[]>(initialResults)
  const [lastError, setLastError] = useState<string | null>(null)
  const [expandedResult, setExpandedResult] = useState<number | null>(
    results.length > 0 ? results[0]!.id : null,
  )
  const router = useRouter()

  const handleCheck = useCallback(async () => {
    if (!sessionId || !containerName) return
    setChecking(true)
    setLastError(null)

    const response = await runCheck({
      problemId,
      sessionId,
      containerName,
    })

    if (response.status === "success") {
      // Refresh results from DB
      const freshResults = await getCheckResults({ problemId })
      setResults(freshResults)
      setExpandedResult(freshResults[0]?.id ?? null)
      router.refresh()
    } else {
      setLastError(response.message)
    }

    setChecking(false)
  }, [problemId, sessionId, containerName, router])

  return (
    <div className="flex h-full flex-col gap-4">
      {/* Check Button */}
      <button
        onClick={handleCheck}
        disabled={checking || !sessionId}
        className={cn(
          "flex items-center justify-center gap-2 rounded-md px-6 py-3 font-clash-display text-lg font-semibold transition-colors",
          {
            "cursor-pointer bg-blue-600 text-white hover:bg-blue-500":
              !checking && sessionId,
            "cursor-not-allowed bg-neutral-300 text-neutral-500 dark:bg-neutral-700 dark:text-neutral-400":
              checking || !sessionId,
          },
        )}
      >
        {checking ? (
          <>
            <ImSpinner3 className="animate-spin" />
            Checking...
          </>
        ) : !sessionId ? (
          "Waiting for environment..."
        ) : (
          "Check My Work"
        )}
      </button>

      {lastError && (
        <div className="rounded-md border border-red-300 bg-red-50 px-4 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/30 dark:text-red-400">
          {lastError}
        </div>
      )}

      {/* Results List */}
      <div className="flex grow flex-col gap-2 overflow-y-auto">
        {results.length === 0 && !checking && (
          <div className="flex grow items-center justify-center text-neutral-500">
            <p>Run a check to see your results</p>
          </div>
        )}

        {results.map((result, index) => (
          <div
            key={result.id}
            className={cn(
              "cursor-pointer rounded-md border transition-colors",
              {
                "border-green-300 bg-green-50 dark:border-green-800 dark:bg-green-900/20":
                  result.passed,
                "border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-900/20":
                  !result.passed,
              },
            )}
            onClick={() =>
              setExpandedResult(expandedResult === result.id ? null : result.id)
            }
          >
            <div className="flex items-center justify-between px-4 py-2">
              <div className="flex items-center gap-3">
                <div
                  className={cn("text-lg font-bold", {
                    "text-green-600 dark:text-green-400": result.passed,
                    "text-red-600 dark:text-red-400": !result.passed,
                  })}
                >
                  {result.passed ? "PASSED" : "FAILED"}
                </div>
                <span className="text-sm text-neutral-500">
                  Check #{results.length - index}
                </span>
              </div>
              <div className="flex items-center gap-4">
                <span
                  className={cn("font-mono text-sm font-semibold", {
                    "text-green-700 dark:text-green-400": result.passed,
                    "text-red-700 dark:text-red-400": !result.passed,
                  })}
                >
                  {result.score}/{result.total}
                </span>
                <span className="text-xs text-neutral-400">
                  {moment(result.createdAt).fromNow()}
                </span>
              </div>
            </div>

            {expandedResult === result.id && (
              <div className="border-t px-4 py-3">
                <CheckOutputDisplay output={result.output} />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function CheckOutputDisplay({ output }: { output: string }) {
  const lines = output.split("\n")

  return (
    <div className="space-y-1 font-mono text-sm">
      {lines.map((line, i) => {
        const trimmed = line.trim()
        if (!trimmed) return null

        // Parse PASS/FAIL lines
        if (trimmed.includes("PASS")) {
          const description = trimmed.replace(/^\s*PASS\s*-\s*/, "")
          return (
            <div key={i} className="flex items-center gap-2">
              <span className="font-bold text-green-600 dark:text-green-400">
                PASS
              </span>
              <span className="text-neutral-700 dark:text-neutral-300">
                {description}
              </span>
            </div>
          )
        }

        if (trimmed.includes("FAIL")) {
          const description = trimmed.replace(/^\s*FAIL\s*-\s*/, "")
          return (
            <div key={i} className="flex items-center gap-2">
              <span className="font-bold text-red-600 dark:text-red-400">
                FAIL
              </span>
              <span className="text-neutral-700 dark:text-neutral-300">
                {description}
              </span>
            </div>
          )
        }

        // Score line
        if (trimmed.includes("Score:")) {
          return (
            <div
              key={i}
              className="mt-2 font-semibold text-neutral-800 dark:text-neutral-200"
            >
              {trimmed}
            </div>
          )
        }

        // Header lines
        if (trimmed.includes("====")) {
          return null // Skip separator lines
        }

        // Everything else
        return (
          <div key={i} className="text-neutral-600 dark:text-neutral-400">
            {trimmed}
          </div>
        )
      })}
    </div>
  )
}
