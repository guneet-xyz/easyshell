import { AlternativeProblemStatus } from "@/components/problem-status"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { auth } from "@/lib/server/auth"
import { getProblemStatus, getPublicProblemInfo } from "@/lib/server/problems"
import { getUserSubmissionStats } from "@/lib/server/queries"
import { getSeries } from "@/lib/server/series"
import { getPathname } from "@/lib/server/utils"
import { cn } from "@/lib/utils"

import Link from "next/link"
import { notFound } from "next/navigation"
import { PiPlayDuotone } from "react-icons/pi"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const series = await getSeries(slug)
  return {
    title: `series - ${slug}`,
    description: series?.description,
  }
}

export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const series = await getSeries(slug)
  if (!series) {
    notFound()
  }

  const session = await auth()
  const userId = session?.user.id
  const problems = Array.from(
    new Set(series.sections.map((s) => s.problems).flat()),
  )

  return (
    <div className="flex flex-col">
      <div className="mt-10 font-clash-display text-4xl font-bold">
        {series.name}
      </div>
      <div className="mb-10 font-clash-display text-2xl">
        {series.description}
      </div>
      <div className="flex flex-col-reverse gap-8 md:flex-row">
        <div className="flex flex-col">
          <div className="flex flex-col gap-4">
            {series.sections.map((section) => (
              <div key={section.title}>
                <div className="font-clash-display text-2xl font-semibold">
                  {section.title}
                </div>
                <div className="dark:text-neutral-200">
                  {section.description}
                </div>
                <div className="flex flex-col items-center justify-center gap-2 p-2">
                  {section.problems.map((p) => (
                    <Problem key={p} slug={p} userId={userId} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="mx-auto h-fit min-w-60 rounded-xl border px-6 py-4">
          {userId ? (
            <ProgressColumn userId={userId} problems={problems} />
          ) : (
            <div>
              <div className="text-center font-clash-display text-2xl font-semibold">
                Progress
              </div>
              <div className="mt-2 rounded-xl border p-4 shadow-lg">
                <div className="rounded-md border p-2 text-center text-sm text-neutral-600 dark:text-neutral-400">
                  Log in see your progress
                </div>
                <LoginButton />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

async function LoginButton() {
  const pathname = await getPathname()
  return (
    <Link href={`/login?callback=${pathname}`} prefetch={true}>
      <Button className="mt-2 w-full py-2">Login</Button>
    </Link>
  )
}

async function ProgressColumn({
  userId,
  problems,
}: {
  userId: string
  problems: Array<string>
}) {
  const submission_stats = await getUserSubmissionStats(userId)
  const num_solved = problems.filter(
    (p) => submission_stats.problems[p] === "solved",
  ).length
  const total = problems.length
  const progress = Math.round((num_solved * 100) / total)
  const next_problem = problems.find(
    (p) => submission_stats.problems[p] !== "solved",
  )

  const next_problem_info = next_problem
    ? await getPublicProblemInfo(next_problem)
    : null

  return (
    <div className="flex flex-row items-center justify-between gap-20 md:flex-col md:gap-4">
      <div className="flex w-full flex-col">
        <div className="text-center font-clash-display text-2xl font-semibold">
          Progress
        </div>
        <Progress
          value={progress}
          className="my-2 bg-emerald-100 *:bg-emerald-600 dark:bg-emerald-950 dark:*:bg-emerald-800"
        />
        <div className="flex w-full items-center justify-between">
          <div className="rounded-full border px-2 font-geist-mono text-sm whitespace-nowrap dark:border-emerald-500/20 dark:bg-emerald-700/20">
            {num_solved}/{total}
          </div>
          <div className="rounded-full border px-2 font-geist-mono text-sm whitespace-nowrap dark:border-emerald-500/20 dark:bg-emerald-700/20">
            {progress} %
          </div>
        </div>
      </div>
      {next_problem_info && (
        <div className="flex w-full flex-col">
          <div className="text-center font-clash-display font-semibold">
            {progress === 0 ? `Start Your Journey :` : `Next Up :`}
          </div>
          <Link
            prefetch={true}
            href={`/problems/${next_problem_info.slug}`}
            className={cn(
              "mt-2 flex w-full justify-between gap-4 rounded-xl border px-4 py-2 transition-colors",
              {
                "border-emerald-700/50 hover:border-emerald-700":
                  next_problem_info.difficulty === "easy",
                "border-yellow-700/50 hover:border-yellow-700":
                  next_problem_info.difficulty === "medium",
                "border-rose-700/50 hover:border-rose-700":
                  next_problem_info.difficulty === "hard",
              },
              {
                "bg-emerald-500/10 hover:bg-emerald-500/15":
                  next_problem_info.difficulty === "easy",
                "bg-yellow-500/10 hover:bg-yellow-500/15":
                  next_problem_info.difficulty === "medium",
                "bg-rose-500/10 hover:bg-rose-500/15":
                  next_problem_info.difficulty === "hard",
              },
            )}
          >
            <div className="flex flex-col justify-between">
              <div className="font-clash-display font-medium whitespace-nowrap">
                {next_problem_info.title}
              </div>
              <div className="font-geist-mono text-xs whitespace-nowrap">
                {next_problem_info.slug}
              </div>
            </div>
            <div className="flex flex-col items-end justify-between">
              <PiPlayDuotone
                className={cn("text-lg dark:text-neutral-500", {})}
              />
              <span
                className={cn("text-xs", {
                  "text-red-500": next_problem_info.difficulty === "hard",
                  "text-yellow-500": next_problem_info.difficulty === "medium",
                  "text-green-500": next_problem_info.difficulty === "easy",
                })}
              >
                {next_problem_info.difficulty}
              </span>
            </div>
          </Link>
        </div>
      )}
    </div>
  )
}

async function Problem({ slug, userId }: { slug: string; userId?: string }) {
  const { id, title, difficulty } = await getPublicProblemInfo(slug)
  const status = userId ? await getProblemStatus(slug, userId) : undefined

  return (
    <Link
      prefetch={true}
      href={`/problems/${slug}`}
      className={cn(
        "group flex w-120 items-center justify-between overflow-hidden rounded-xl px-4 py-2 shadow",
        "relative border border-b-4",
        {
          "border-green-600/40 dark:border-green-400/40": difficulty === "easy",
          "border-yellow-600/40 dark:border-amber-400/40":
            difficulty === "medium",
          "border-red-600/40 dark:border-rose-400/40": difficulty === "hard",
        },
      )}
    >
      <div
        className={cn(
          "absolute top-0 left-0 -z-10 h-full w-full",
          "bg-linear-to-b via-10% to-neutral-100 opacity-50 transition-opacity group-hover:opacity-100 dark:to-neutral-900",
          {
            "from-emerald-100 via-emerald-50 dark:from-emerald-500/20 dark:via-emerald-300/10":
              difficulty === "easy",
            "from-yellow-100 via-yellow-50 dark:from-yellow-500/20 dark:via-yellow-300/10":
              difficulty === "medium",
            "from-rose-100 via-rose-50 dark:from-rose-500/20 dark:via-rose-300/10":
              difficulty === "hard",
          },
        )}
      />
      <div className="flex flex-col">
        <div className="font-clash-display text-xl font-medium">{title}</div>
        <div className="flex gap-2 font-geist-mono text-xs">
          <span className="dark:text-neutral-400">{slug}</span>
          <span
            className={cn({
              "text-red-500": difficulty === "hard",
              "text-yellow-500": difficulty === "medium",
              "text-green-500": difficulty === "easy",
            })}
          >
            {difficulty}
          </span>
        </div>
      </div>
      <div className="flex flex-col items-end font-clash-display font-semibold text-neutral-600">
        <div>#{id}</div>
        <AlternativeProblemStatus
          status={status}
          showTooltip
          showNotAttempted
        />
      </div>
    </Link>
  )
}
