"use client"

import moment from "moment"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useEffect, useState } from "react"
import { RotateCcw } from "lucide-react"
import { PiCopySimple, PiCopySimpleDuotone } from "react-icons/pi"
import { toast } from "sonner"

import { Back } from "@/components/back"
import { Button } from "@/components/ui/button"
import { getSubmissionInfo } from "@/lib/server/actions/get-submission-info"
import { getTestcaseInfo } from "@/lib/server/actions/get-testcase-info"
import { retryAllFailedTestcases } from "@/lib/server/actions/retry-all-failed-testcases"
import { retryFailedTestcase } from "@/lib/server/actions/retry-failed-testcase"
import { cn, sleep } from "@/lib/utils"

import { FsDiff } from "./fs-diff"

export function Submission({ submissionId }: { submissionId: number }) {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()

  const _testcase = searchParams.get("testcase")
  const selectedTestcaseId = _testcase ? parseInt(_testcase) : null

  function setSelectedTestcaseId(tc: number | null) {
    if (tc === null)
      router.replace(`${pathname}?tab=submissions&submission=${submissionId}`)
    else
      router.replace(
        `${pathname}?tab=submissions&submission=${submissionId}&testcase=${tc}`,
      )
  }

  const [info, setInfo] = useState<Awaited<
    ReturnType<typeof getSubmissionInfo>
  > | null>(null)
  const [pollingRun, setPollingRun] = useState(0)

  function refetchSubmissionInfo() {
    setInfo(null)
    setPollingRun((run) => run + 1)
  }

  async function handleRetryTestcase(testcaseId: number) {
    try {
      await retryFailedTestcase({ submissionId, testcaseId })
      toast.success("Testcase requeued for re-run")
      refetchSubmissionInfo()
    } catch (error) {
      if (error instanceof Error) {
        toast.error("Failed to retry testcase", {
          description: error.message,
        })
        return
      }
      toast.error("Failed to retry testcase")
    }
  }

  async function handleRetryAllFailedTestcases() {
    try {
      await retryAllFailedTestcases({ submissionId })
      toast.success("Failed testcases requeued for re-run")
      refetchSubmissionInfo()
    } catch (error) {
      if (error instanceof Error) {
        toast.error("Failed to retry testcases", {
          description: error.message,
        })
        return
      }
      toast.error("Failed to retry testcases")
    }
  }

  useEffect(() => {
    void (async () => {
      while (true) {
        const newInfo = await getSubmissionInfo({ submissionId })
        setInfo(newInfo)
        let fetchAgain = false
        for (const testcase of newInfo.testcases) {
          if (
            testcase.status !== "finished" &&
            testcase.status !== "failed" &&
            testcase.status !== "cancelled"
          ) {
            fetchAgain = true
            break
          }
        }
        if (!fetchAgain) break
        await sleep(1000)
      }
    })()
  }, [submissionId, pollingRun])

  if (selectedTestcaseId)
    return (
      <div className="h-full">
        <Back href={`${pathname}?tab=submissions&submission=${submissionId}`} />
        <Testcase submissionId={submissionId} testcaseId={selectedTestcaseId} />
      </div>
    )

  if (!info) return <SubmissionSkeleton />

  const hasFailedTestcase = info.testcases.some(
    (testcase) => testcase.status === "failed",
  )

  return (
    <div>
      <Back href={`${pathname}?tab=submissions`} />
      <div className="flex flex-col gap-4">
        <div className="flex flex-col items-center">
          <h2 className="text-2xl font-bold">
            Attempt #{info.submission.attempt}
          </h2>
          <div className="text-xs text-neutral-400">
            {moment(info.submission.submittedAt).fromNow()}
          </div>
        </div>
        <div className="flex flex-col gap-2 rounded-xl border p-8 shadow">
          <div className="flex items-end justify-between">
            <div className="text-xl font-semibold">Input</div>
            <div
              className="group relative h-4 w-4 cursor-pointer"
              onClick={async () => {
                await navigator.clipboard.writeText(info.submission.input)
                toast.success("Copied to clipboard")
              }}
            >
              <PiCopySimple className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-100 transition-opacity group-hover:opacity-0" />
              <PiCopySimpleDuotone className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-0 transition-opacity group-hover:opacity-100" />
            </div>
          </div>
          <div className="rounded-md border bg-neutral-200 px-2 py-1 text-center font-mono text-sm whitespace-pre-wrap dark:bg-neutral-800">
            {info.submission.input}
          </div>
        </div>
        <div className="flex flex-col gap-2 rounded-xl border p-8 shadow dark:bg-neutral-900">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-xl font-semibold">Testcases</div>
            {hasFailedTestcase ? (
              <Button
                data-testid="retry-all-failed-btn"
                variant="outline"
                size="sm"
                className="gap-2 border-orange-300 text-orange-600 hover:bg-orange-50 dark:border-orange-700 dark:text-orange-400 dark:hover:bg-orange-950/30"
                onClick={() => void handleRetryAllFailedTestcases()}
              >
                <RotateCcw className="h-4 w-4" />
                Retry failed testcases
              </Button>
            ) : null}
          </div>
          <div className="flex flex-wrap justify-center gap-4 px-8">
            {info.testcases.map((testcase) => (
              <div
                key={testcase.id}
                className={cn(
                  "cursor-pointer rounded-xl border border-neutral-400 bg-neutral-100 px-6 py-2 transition-colors hover:bg-neutral-200 dark:border-neutral-600 dark:bg-neutral-900 dark:hover:bg-neutral-800",
                  {
                    "border-green-300 bg-green-300/30 hover:bg-green-300/50 dark:border-green-700 dark:bg-green-700/30 dark:hover:bg-green-700/50":
                      testcase.status === "finished" && testcase.passed,
                    "border-red-300 bg-red-300/30 hover:bg-red-300/50 dark:border-red-700 dark:bg-red-700/30 dark:hover:bg-red-700/50":
                      testcase.status === "finished" && !testcase.passed,
                    "border-orange-300 bg-orange-300/30 hover:bg-orange-300/50 dark:border-orange-700 dark:bg-orange-700/30 dark:hover:bg-orange-700/50":
                      testcase.status === "failed",
                  },
                )}
                onClick={() => setSelectedTestcaseId(testcase.id)}
              >
                <p className="text-md font-semibold">Testcase #{testcase.id}</p>
                <div className="mt-1 flex items-center justify-between gap-3">
                  <p
                    className={cn("text-sm opacity-80", {
                      "text-neutral-400":
                        testcase.status === "pending" ||
                        testcase.status === "running",
                      "text-red-500":
                        testcase.status === "finished" && !testcase.passed,
                      "text-green-500":
                        testcase.status === "finished" && testcase.passed,
                      "text-orange-500": testcase.status === "failed",
                    })}
                  >
                    {testcase.status === "pending"
                      ? "Pending"
                      : testcase.status === "running"
                        ? "Running"
                        : testcase.status === "failed"
                          ? "Failed to execute"
                          : testcase.status === "cancelled"
                            ? "Cancelled"
                            : testcase.passed
                              ? "Passed"
                              : "Wrong answer"}
                  </p>
                  {testcase.status === "failed" ? (
                    <Button
                      data-testid={`retry-testcase-btn-${testcase.id}`}
                      variant="outline"
                      size="sm"
                      className="h-7 gap-1 border-orange-300 px-2 text-xs text-orange-600 hover:bg-orange-50 dark:border-orange-700 dark:text-orange-400 dark:hover:bg-orange-950/30"
                      onClick={(event) => {
                        event.stopPropagation()
                        void handleRetryTestcase(testcase.id)
                      }}
                    >
                      <RotateCcw className="h-3 w-3" />
                      Retry
                    </Button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function Testcase({
  submissionId,
  testcaseId,
}: {
  submissionId: number
  testcaseId: number
}) {
  const [info, setInfo] = useState<Awaited<
    ReturnType<typeof getTestcaseInfo>
  > | null>(null)

  useEffect(() => {
    void (async () => {
      setInfo(await getTestcaseInfo({ submissionId, testcaseId }))
    })()
  }, [testcaseId, submissionId])

  if (!info) return <TestcaseSkeleton />

  return (
    <div className={cn("flex h-full flex-col gap-4")}>
      <div className="flex flex-col gap-0">
        <h1 className="text-center text-xl font-bold">
          Testcase #{testcaseId}
        </h1>
        <h2
          className={cn("text-center font-semibold", {
            "text-red-500": !info.passed,
            "text-green-500": info.passed,
          })}
        >
          {info.passed ? "Passed" : "Failed"}
        </h2>
      </div>
      {info.expected_stdout !== undefined ? (
        <div className="flex flex-col gap-2 rounded-xl border p-8 shadow">
          <div className="text-center text-lg font-semibold">Stdout</div>
          <Diff expected={info.expected_stdout} actual={info.stdout} />
        </div>
      ) : null}
      {info.expected_stderr !== undefined ? (
        <Diff expected={info.expected_stderr} actual={info.stderr} />
      ) : null}
      {info.expected_fs !== undefined ? (
        <FsDiff expected={info.expected_fs} actual={info.fs!} />
      ) : null}
    </div>
  )
}

function Diff({ expected, actual }: { expected: string; actual: string }) {
  return (
    <div className="flex gap-4">
      <div className="w-full">
        <div className="font-medium">Expected</div>
        <div className="mt-2 overflow-x-auto rounded-md p-2 font-geist-mono text-sm whitespace-pre dark:bg-neutral-800">
          {expected}
        </div>
      </div>
      <div className="w-full">
        <div className="font-medium">Actual</div>
        <div className="mt-2 overflow-x-auto rounded-md p-2 font-geist-mono text-sm whitespace-pre dark:bg-neutral-800">
          {actual}
        </div>
      </div>
    </div>
  )
}

function SubmissionSkeleton() {
  const pathname = usePathname()
  return (
    <div>
      <Back href={`${pathname}?tab=submissions`} />
      <div className="flex flex-col gap-4">
        <div className="flex flex-col items-center">
          <h2 className="text-2xl font-bold">Loading</h2>
          <div className="h-4 w-20 animate-pulse rounded-full text-xs text-neutral-400" />
        </div>
        <div className="flex flex-col gap-2 rounded-xl border p-8 shadow">
          <div className="flex items-end justify-between">
            <div className="text-xl font-semibold">Input</div>
            <div className="group relative h-4 w-4 cursor-pointer">
              <PiCopySimple className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-100 transition-opacity group-hover:opacity-0" />
              <PiCopySimpleDuotone className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-0 transition-opacity group-hover:opacity-100" />
            </div>
          </div>
          <div className="h-8 animate-pulse rounded-md border bg-neutral-200 dark:bg-neutral-800" />
        </div>
        <div className="flex flex-col gap-2 rounded-xl border p-8 shadow dark:bg-neutral-900">
          <div className="text-xl font-semibold">Testcases</div>
          <div className="flex h-20 animate-pulse bg-neutral-200 dark:bg-neutral-800" />
        </div>
      </div>
    </div>
  )
}

function TestcaseSkeleton() {
  return (
    <div className={cn("flex h-full flex-col gap-4")}>
      <div className="flex flex-col items-center gap-0">
        <h1 className="text-center text-xl font-bold">Loading Testcase</h1>
        <h2 className="mt-2 h-6 w-20 animate-pulse rounded-full bg-neutral-200 dark:bg-neutral-800" />
      </div>
    </div>
  )
}
