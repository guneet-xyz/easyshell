import { AlternativeProblemStatus } from "@/components/problem-status"
import { EasyTooltip } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

import Link from "next/link"

export function ProblemLinkBase({
  status,
  difficulty,
  slug,
  className,
}: {
  status?: "solved" | "attempted"
  difficulty?: "easy" | "medium" | "hard"
  slug: string
  className?: string
}) {
  return (
    <EasyTooltip
      dontInterceptClick
      tip={
        status === "solved"
          ? "Solved"
          : status === "attempted"
            ? "Attempted"
            : "Not Attempted"
      }
    >
      <Link
        prefetch={true}
        href={`/problems/${slug}`}
        className={cn(
          "shadow-xs ml-1 inline w-fit space-x-1 whitespace-nowrap rounded-md border px-2 py-1",
          {
            "bg-green-100": difficulty === "easy",
            "border-orange-400 bg-orange-100 shadow-orange-400 dark:border-orange-600 dark:bg-orange-900 dark:shadow-orange-600":
              difficulty === "medium",
          },
          className,
        )}
      >
        <span
          className={cn("font-geist-mono inline text-xs font-medium", {
            "text-orange-600 dark:text-orange-400": difficulty === "medium",
          })}
        >
          {slug}
        </span>
        <AlternativeProblemStatus
          status={status}
          className={cn("inline size-5", {
            "text-orange-600 dark:text-orange-400": difficulty === "medium",
          })}
        />
      </Link>
    </EasyTooltip>
  )
}
