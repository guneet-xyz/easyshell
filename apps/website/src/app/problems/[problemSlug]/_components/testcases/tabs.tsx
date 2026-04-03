"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Suspense, useEffect } from "react"

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

import { TestcaseTerminal } from "./terminal"

export function TestcaseTabs({
  problemId,
  problemSlug,
  testcases,
}: {
  problemId: number
  problemSlug: string
  testcases: number[]
}) {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()

  const _testcase = searchParams.get("testcase")
  const testcase = _testcase ? parseInt(_testcase) : 1

  useEffect(() => {
    for (const tc of testcases) {
      router.prefetch(`${pathname}?tab=testcases&testcase=${tc}`)
    }
  }, [testcases, pathname, router])

  function setTestcase(tc: string) {
    router.push(`${pathname}?tab=testcases&testcase=${tc}`)
  }

  return (
    <div className="flex h-full flex-col">
      <Tabs value={testcase.toString()} onValueChange={setTestcase}>
        <TabsList className="w-full">
          {testcases.map((tc) => (
            <TabsTrigger key={tc} value={tc.toString()} className="grow">
              Test Case {tc}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <div className="grow p-2">
        <Suspense fallback={<div>Loading</div>}>
          <TestcaseTerminal
            problemId={problemId}
            problemSlug={problemSlug}
            testcase={testcase}
          />
        </Suspense>
      </div>
    </div>
  )
}
