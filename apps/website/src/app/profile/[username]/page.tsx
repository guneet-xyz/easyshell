import { submissionTestcases, submissions } from "@easyshell/db/schema"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Card } from "@/components/ui/card"
import { db } from "@/db"
import { getUserByUsername } from "@/lib/server/auth"
import {
  getProblemSlugFromId,
  getProblems,
  getPublicProblemInfo,
} from "@/lib/server/problems"

import { SubmissionsChart } from "./_components/submission-chart"

import { desc, eq, min, sql } from "drizzle-orm"
import moment from "moment"
import { Metadata } from "next"
import { notFound, redirect } from "next/navigation"
import { PiCheckCircle, PiXCircle } from "react-icons/pi"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>
}): Promise<Metadata> {
  const { username } = await params
  return {
    title: `easyshell - profile/${username}`,
    description: `Profile page of ${username}`,
  }
}

async function getRecentlySolved(userId: string) {
  const user_submissions = db.$with("user_submissions").as(
    db
      .select({
        submissionId: submissions.id,
        problemId: submissions.problemId,
        submittedAt: submissions.submittedAt,
      })
      .from(submissions)
      .where(eq(submissions.userId, userId)),
  )

  const user_submission_passed = db.$with("user_submission_passed").as(
    db
      .with(user_submissions)
      .select({
        submissionId: user_submissions.submissionId,
        passed:
          sql<boolean>`cast(${min(sql`cast(${submissionTestcases.passed} as int)`)} as boolean)`.as(
            "passed",
          ),
      })
      .from(submissionTestcases)
      .innerJoin(
        user_submissions,
        eq(submissionTestcases.submissionId, user_submissions.submissionId),
      )
      .groupBy(submissionTestcases.submissionId, user_submissions.submissionId),
  )

  const user_submissions_with_passed = await db
    .with(user_submission_passed, user_submissions)
    .select({
      submissionId: user_submissions.submissionId,
      problemId: user_submissions.problemId,
      submittedAt: user_submissions.submittedAt,
      passed: user_submission_passed.passed,
    })
    .from(user_submissions)
    .innerJoin(
      user_submission_passed,
      eq(user_submission_passed.submissionId, user_submissions.submissionId),
    )
    .orderBy(desc(user_submissions.submittedAt))

  return user_submissions_with_passed
}

export async function getSubmissionStats(userId: string) {
  const user_submissions = db.$with("user_submissions").as(
    db
      .select({
        submissionId: submissions.id,
        problemId: submissions.problemId,
      })
      .from(submissions)
      .where(eq(submissions.userId, userId)),
  )

  const user_submissions_passed = db.$with("user_submission_passed").as(
    db
      .with(user_submissions)
      .select({
        problemId: user_submissions.problemId,
        passed:
          sql<boolean>`cast(${min(sql`cast(${submissionTestcases.passed} as int)`)} as boolean)`.as(
            "passed",
          ),
      })
      .from(submissionTestcases)
      .innerJoin(
        user_submissions,
        eq(submissionTestcases.submissionId, user_submissions.submissionId),
      )
      .groupBy(submissionTestcases.submissionId, user_submissions.problemId)
      .having(({ passed }) => eq(passed, true)),
  )

  const user_distinct_problems = await db
    .with(user_submissions_passed)
    .selectDistinctOn([user_submissions_passed.problemId], {
      problemId: user_submissions_passed.problemId,
    })
    .from(user_submissions_passed)

  const solved_problems = await Promise.all(
    user_distinct_problems.map(async ({ problemId }) => {
      const problemSlug = await getProblemSlugFromId(problemId)
      const { difficulty } = await getPublicProblemInfo(problemSlug)
      return {
        problemId,
        problemSlug,
        difficulty,
      }
    }),
  )

  let easy = 0
  let medium = 0
  let hard = 0

  for (const { difficulty } of solved_problems) {
    if (difficulty === "easy") easy++
    else if (difficulty === "medium") medium++
    else if (difficulty === "hard") hard++
  }

  const allProblems = await Promise.all(
    (await getProblems()).map(async (p) => await getPublicProblemInfo(p)),
  )
  const totalEasy = allProblems.filter((p) => p.difficulty === "easy").length
  const totalMedium = allProblems.filter(
    (p) => p.difficulty === "medium",
  ).length
  const totalHard = allProblems.filter((p) => p.difficulty === "hard").length

  return {
    easy,
    medium,
    hard,
    totalEasy,
    totalMedium,
    totalHard,
  }
}

export default async function Page({
  params,
}: {
  params: Promise<{ username: string }>
}) {
  const { username } = await params
  if (username !== username.toLowerCase()) redirect(`${username.toLowerCase()}`)

  const user = await getUserByUsername(username)
  if (!user) notFound()

  const recentlySolved = await Promise.all(
    (await getRecentlySolved(user.id)).map(async (rs) => ({
      ...rs,
      problemSlug: await getProblemSlugFromId(rs.problemId),
    })),
  )

  const submissionStats = await getSubmissionStats(user.id)

  return (
    <div className="mx-auto mt-8 flex w-[90%] flex-col gap-4 md:w-4/5">
      <Card className="flex items-center gap-4 px-4 py-2 md:px-8 md:py-4">
        <Avatar className="mr-1.5 size-20">
          <AvatarImage src={user.image ?? ""} />
          <AvatarFallback>{user.username[0]}</AvatarFallback>
        </Avatar>
        <div className="flex flex-col gap-1 md:grow md:flex-row md:items-center md:justify-between">
          <div className="flex flex-col">
            <div className="font-clash-display text-2xl font-semibold">
              {user.username}
            </div>
            <div className="font-clash-display text-xl text-neutral-500 dark:text-neutral-500">
              {user.name}
            </div>
          </div>
          <div className="font-clash-display text-sm text-neutral-500 dark:text-neutral-500">
            Joined {moment(user.joinedAt).fromNow()}
          </div>
        </div>
      </Card>
      <div className="flex gap-4">
        <Card className="flex aspect-square max-h-80 w-full items-center justify-center">
          <SubmissionsChart stats={submissionStats} />
        </Card>
        <Card className="flex aspect-square max-h-80 w-full flex-col items-center justify-center font-clash-display">
          <div className="text-2xl">Badges</div>
          <div className="text-xl text-neutral-500">(coming soon)</div>
        </Card>
      </div>
      <div className="mt-8 font-clash-display text-3xl font-semibold">
        Recent Submissions
      </div>
      <div className="flex flex-col gap-2">
        {recentlySolved.map((rs) => (
          <div
            key={rs.submissionId}
            className="flex items-center gap-4 rounded-md border bg-neutral-100 p-4 dark:bg-neutral-950"
          >
            <div className="text-2xl">
              {rs.passed ? (
                <PiCheckCircle className="text-emerald-500" />
              ) : (
                <PiXCircle className="text-rose-500" />
              )}
            </div>
            <div className="font-geist-mono text-sm md:text-base">
              {rs.problemSlug}
            </div>
            <div className="ml-auto text-xs text-neutral-500 md:text-sm">
              {moment(rs.submittedAt).fromNow()}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
