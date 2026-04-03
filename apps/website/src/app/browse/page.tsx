import { auth } from "@/lib/server/auth"
import { getUserBookmarks } from "@/lib/server/bookmarks"
import {
  getAllTags,
  getProblems,
  getPublicProblemInfo,
} from "@/lib/server/problems"
import { getUserSubmissionStats } from "@/lib/server/queries"
import { getAllSeries } from "@/lib/server/series"

import { RecentActivity } from "./_components/activity"
import { ProblemList } from "./_components/problems"
import { SeriesCarousel } from "./_components/series"

export const metadata = {
  title: "easyshell - browse",
}

export default async function Page() {
  const session = await auth()
  const user = session?.user
  const submission_stats = user ? await getUserSubmissionStats(user.id) : null

  const problems = (
    await Promise.all(
      (await getProblems()).map(async (problem) => {
        const info = await getPublicProblemInfo(problem)
        return {
          ...info,
          status: submission_stats
            ? submission_stats.problems[info.slug]
            : undefined,
        }
      }),
    )
  ).sort((a, b) => a.id - b.id)
  const tags = await getAllTags()
  const allSeries = await getAllSeries()

  const user_bookmarks = user ? await getUserBookmarks(user.id) : []
  const user_attempted = submission_stats
    ? Object.keys(submission_stats.problems).filter(
        (slug) => submission_stats.problems[slug] === "attempted",
      )
    : []

  return (
    <div className="flex flex-col">
      <div className="flex flex-col-reverse gap-4 md:flex-row">
        <div className="flex grow flex-col overflow-hidden">
          <div className="font-clash-display text-2xl font-semibold">
            Series
          </div>
          <div className="mb-4 font-clash-display text-sm text-neutral-500 md:text-base">
            Curated list of problems to master specific topics.
          </div>
          <SeriesCarousel
            submission_stats={submission_stats}
            allSeries={allSeries}
          />
        </div>
        <RecentActivity
          bookmarks={user_bookmarks}
          loggedIn={!!user}
          attempted={user_attempted}
        />
      </div>
      <ProblemList problems={problems} tags={tags} />
    </div>
  )
}
