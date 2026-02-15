"use client"

import type { getSubmissionStats } from "@/app/profile/[username]/page"
import { EasyTooltip } from "@/components/ui/tooltip"
import { useTheme } from "@/lib/client"

const COLORS = {
  dark: {
    nothover: {
      easy: {
        primary: "#047857", // emerald-700
        secondary: "#022c22", // emerald-950
      },
      medium: {
        primary: "#b45309", // amber-700
        secondary: "#451a03", // amber-950
      },
      hard: {
        primary: "#b91c1c", // red-700
        secondary: "#450a0a", // red-950
      },
    },
    hover: {
      easy: {
        primary: "#059669", // emerald-600
        secondary: "#064e3b", // emerald-900
      },
      medium: {
        primary: "#d97706", // amber-600
        secondary: "#78350f", // amber-900
      },
      hard: {
        primary: "#dc2626", // red-600
        secondary: "#7f1d1d", // red-900
      },
    },
  },
  light: {
    nothover: {
      easy: {
        primary: "#6ee7b7", // emerald-300
        secondary: "#d1fae5", // emerald-100
      },
      medium: {
        primary: "#fdba74", // orange-300
        secondary: "#ffedd5", // orange-100
      },
      hard: {
        primary: "#fca5a5",
        secondary: "#fee2e2", // red-100
      },
    },
    hover: {
      easy: {
        primary: "#34d399", // emerald-400
        secondary: "#a7f3d0", // emerald-200
      },
      medium: {
        primary: "#fb923c", // orange-400
        secondary: "#fed7aa", // orange-200
      },
      hard: {
        primary: "#f87171", // red-400
        secondary: "#fecaca", // red-200
      },
    },
  },
}

export default function SubmissionsChart({
  stats,
}: {
  stats: Awaited<ReturnType<typeof getSubmissionStats>>
}) {
  const { theme } = useTheme()

  const easyPercent =
    stats.totalEasy !== 0 ? Math.round((stats.easy * 100) / stats.totalEasy) : 0
  const mediumPercent =
    stats.totalMedium !== 0
      ? Math.round((stats.medium * 100) / stats.totalMedium)
      : 0
  const hardPercent =
    stats.totalHard !== 0 ? Math.round((stats.hard * 100) / stats.totalHard) : 0

  return (
    <div className="relative aspect-square h-full">
      <div
        className="absolute top-1/2 left-1/2 z-1 aspect-square h-[90%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-emerald-300 dark:border-emerald-900"
        style={{
          background: `conic-gradient(${COLORS[theme].nothover.easy.primary} 0% ${easyPercent}%, ${COLORS[theme].nothover.easy.secondary} ${easyPercent}% 100%)`,
        }}
      />
      <EasyTooltip
        contentClassName="bg-emerald-100"
        arrowClassName="bg-emerald-100 fill-emerald-100"
        tip={
          <div className="flex flex-col items-center">
            <div className="text-sm font-semibold text-emerald-500">
              Easy Problems
            </div>
            <div className="z-10 rounded-full border border-emerald-400 bg-emerald-200 px-2 font-geist-mono text-emerald-700 shadow-sm">
              {stats.easy}/{stats.totalEasy}
            </div>
          </div>
        }
      >
        <div
          className="absolute top-1/2 left-1/2 z-2 aspect-square h-[90%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-emerald-500 opacity-0 transition-opacity hover:opacity-100"
          style={{
            background: `conic-gradient(${COLORS[theme].hover.easy.primary} 0% ${easyPercent}%, ${COLORS[theme].hover.easy.secondary} ${easyPercent}% 100%)`,
          }}
        />
      </EasyTooltip>
      <div
        className="absolute top-1/2 left-1/2 z-3 aspect-square h-[75%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-amber-300 transition-all dark:border-amber-900"
        style={{
          background: `conic-gradient(${COLORS[theme].nothover.medium.primary} 0% ${mediumPercent}%, ${COLORS[theme].nothover.medium.secondary} ${mediumPercent}% 100%)`,
        }}
      />
      <EasyTooltip
        contentClassName="bg-amber-100"
        arrowClassName="bg-amber-100 fill-amber-100"
        tip={
          <div className="flex flex-col items-center">
            <div className="text-sm font-semibold text-amber-500">
              Medium Problems
            </div>
            <div className="z-10 rounded-full border border-amber-400 bg-amber-200 px-2 font-geist-mono text-amber-700 shadow-sm">
              {stats.medium}/{stats.totalMedium}
            </div>
          </div>
        }
      >
        <div
          className="absolute top-1/2 left-1/2 z-4 aspect-square h-[75%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-amber-500 opacity-0 transition-opacity hover:opacity-100"
          style={{
            background: `conic-gradient(${COLORS[theme].hover.medium.primary} 0% ${mediumPercent}%, ${COLORS[theme].hover.medium.secondary} ${mediumPercent}% 100%)`,
          }}
        />
      </EasyTooltip>
      <div
        className="absolute top-1/2 left-1/2 z-5 aspect-square h-[60%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-red-300 transition-all dark:border-red-900"
        style={{
          background: `conic-gradient(${COLORS[theme].nothover.hard.primary} 0% ${hardPercent}%, ${COLORS[theme].nothover.hard.secondary} ${hardPercent}% 100%)`,
        }}
      />
      <EasyTooltip
        contentClassName="bg-red-100"
        arrowClassName="bg-red-100 fill-red-100"
        tip={
          <div className="flex flex-col items-center">
            <div className="text-sm font-semibold text-red-500">
              Hard Problems
            </div>
            <div className="z-10 rounded-full border border-red-400 bg-red-200 px-2 font-geist-mono text-red-700 shadow-sm">
              {stats.hard}/{stats.totalHard}
            </div>
          </div>
        }
      >
        <div
          className="absolute top-1/2 left-1/2 z-6 aspect-square h-[60%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-red-500 opacity-0 transition-opacity hover:opacity-100"
          style={{
            background: `conic-gradient(${COLORS[theme].hover.hard.primary} 0% ${hardPercent}%, ${COLORS[theme].hover.hard.secondary} ${hardPercent}% 100%)`,
          }}
        />
      </EasyTooltip>
      <div className="absolute top-1/2 left-1/2 z-7 flex aspect-square h-[45%] -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center gap-2 rounded-full border border-neutral-300 bg-neutral-100 text-sm dark:border-neutral-900 dark:bg-neutral-950">
        <div className="flex items-center gap-2">
          <div className="font-semibold text-emerald-500">Easy</div>
          <div className="rounded-full border border-emerald-200 bg-emerald-50 px-2 font-geist-mono text-emerald-700 shadow-sm shadow-emerald-200 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 dark:shadow-emerald-800">
            {stats.easy}/{stats.totalEasy}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="font-semibold text-amber-500">Medium</div>
          <div className="rounded-full border border-amber-200 bg-amber-50 px-2 font-geist-mono text-amber-700 shadow-sm shadow-amber-200 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300 dark:shadow-amber-800">
            {stats.medium}/{stats.totalMedium}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="font-semibold text-red-500">Hard</div>
          <div className="rounded-full border border-red-200 bg-red-50 px-2 font-geist-mono text-red-700 shadow-sm shadow-red-200 dark:border-red-800 dark:bg-red-950 dark:text-red-300 dark:shadow-red-800">
            {stats.hard}/{stats.totalHard}
          </div>
        </div>
      </div>
    </div>
  )
}
