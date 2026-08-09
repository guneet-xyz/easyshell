import { getAuthSession } from "@/lib/server/auth"
import { getPublicTestcaseInfo } from "@/lib/server/problems"
import { getUserSubmissions } from "@/lib/server/queries"

import { LoginToProceed } from "./login-to-proceed"
import { Problem } from "./problem"
import { Submissions } from "./submissions"
import { ProblemPageTabs } from "./tabs"
import { TestcaseTabs } from "./testcases/tabs"

export async function MobileView({ problemId }: { problemId: string }) {
  const session = await getAuthSession()
  const user = session?.user

  const testcases = await getPublicTestcaseInfo(problemId)
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
            content: <Problem id={problemId} />,
          },
          {
            title: "Testcases",
            value: "testcases",
            content: user ? (
              <TestcaseTabs problemId={problemId} testcases={testcaseIds} />
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
