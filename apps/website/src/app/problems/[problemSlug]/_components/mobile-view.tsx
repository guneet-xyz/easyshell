import { auth } from "@/lib/server/auth"
import { getPublicTestcaseInfo } from "@/lib/server/problems"
import { getUserSubmissions } from "@/lib/server/queries"

import { LoginToProceed } from "./login-to-proceed"
import { Problem } from "./problem"
import { Submissions } from "./submissions"
import { ProblemPageTabs } from "./tabs"
import { TestcaseTabs } from "./testcases/tabs"

export async function MobileView({
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
    <div className="h-full p-2">
      <ProblemPageTabs
        tabs={[
          {
            title: "Problem",
            value: "problem",
            content: <Problem slug={problemSlug} />,
          },
          {
            title: "Testcases",
            value: "testcases",
            content: user ? (
              <TestcaseTabs
                problemId={problemId}
                problemSlug={problemSlug}
                testcases={testcaseIds}
              />
            ) : (
              <LoginToProceed />
            ),
          },
          {
            title: "Submissions",
            value: "submissions",
            content: submissions ? (
              <Submissions
                problemId={problemId}
                problemSlug={problemSlug}
                pastSubmissions={submissions}
              />
            ) : (
              <LoginToProceed />
            ),
          },
        ]}
        defaultValue="problem"
      />
    </div>
  )
}
