import { Suspense } from "react"

import { ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable"
import { auth } from "@/lib/server/auth"
import { getPublicTestcaseInfo } from "@/lib/server/problems"
import { getUserSubmissions } from "@/lib/server/queries"

import { CollapsibleProblemPanel } from "./collapsible-resizeable-panel"
import { LoginToProceed } from "./login-to-proceed"
import { Problem } from "./problem"
import { Submissions } from "./submissions"
import { ProblemPageTabs } from "./tabs"
import { TestcaseTabs } from "./testcases/tabs"

export async function LaptopView({
  problemId,
  problemSlug,
}: {
  problemId: number
  problemSlug: string
}) {
  const session = await auth()
  const user = session?.user

  const testcases = await getPublicTestcaseInfo(problemSlug)
  const testcaseIds = testcases.map((testcase) => testcase.id)
  const submissions = user
    ? await getUserSubmissions({ problemId, userId: user.id })
    : null

  return (
    <ResizablePanelGroup direction="horizontal" className="h-full">
      <CollapsibleProblemPanel>
        <Problem slug={problemSlug} />
      </CollapsibleProblemPanel>
      <ResizablePanel className="flex h-full w-full flex-col p-2">
        <ProblemPageTabs
          tabs={[
            {
              title: "Testcases",
              value: "testcases",
              content: user ? (
                <Suspense fallback={<div>Loading</div>}>
                  <TestcaseTabs
                    problemId={problemId}
                    problemSlug={problemSlug}
                    testcases={testcaseIds}
                  />
                </Suspense>
              ) : (
                <LoginToProceed />
              ),
            },
            {
              title: "Submissions",
              value: "submissions",
              content: submissions ? (
                <Suspense fallback={<div>Loading</div>}>
                  <Submissions
                    problemId={problemId}
                    problemSlug={problemSlug}
                    pastSubmissions={submissions}
                  />
                </Suspense>
              ) : (
                <LoginToProceed />
              ),
            },
          ]}
          defaultValue="submissions"
        />
      </ResizablePanel>
    </ResizablePanelGroup>
  )
}
