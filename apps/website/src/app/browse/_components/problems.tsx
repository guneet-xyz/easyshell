"use client"

import { BadgeButton } from "@/components/badge-button"
import { BadgeCheckbox } from "@/components/badge-checkbox"
import { DesktopContainer, MobileContainer } from "@/components/media"
import { Problems } from "@/components/problems"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import type { getPublicProblemInfo } from "@/lib/server/problems"
import { cn } from "@/lib/utils"

import { useMemo, useState } from "react"
import {
  PiCaretDown,
  PiCaretUp,
  PiMagnifyingGlass,
  PiMinus,
} from "react-icons/pi"
import { PiFunnelDuotone } from "react-icons/pi"

const difficulties = ["easy", "medium", "hard"] as const

export function ProblemList({
  problems,
  tags,
}: {
  problems: Array<
    Awaited<ReturnType<typeof getPublicProblemInfo>> & {
      status?: "attempted" | "solved"
    }
  >
  tags: Array<string>
}) {
  const [filter, setFilter] = useState<{
    search: string
    difficulty: { easy: boolean; medium: boolean; hard: boolean }
    tags: Set<string>
  }>({
    search: "",
    difficulty: { easy: true, medium: true, hard: true },
    tags: new Set(tags),
  })

  const [options, setOptions] = useState<{ showTags: boolean }>({
    showTags: false,
  })

  const [sortOptions, setSortOptions] = useState<{
    id: "asc" | "desc"
    difficulty?: "asc" | "desc"
  }>({
    id: "asc",
    difficulty: undefined,
  })

  const filteredProblems = useMemo(() => {
    return problems
      .filter(
        (problem) =>
          (problem.slug
            .toLowerCase()
            .replaceAll("-", "")
            .includes(
              filter.search
                .toLowerCase()
                .replaceAll("-", "")
                .replaceAll(" ", ""),
            ) ||
            problem.title
              .toLowerCase()
              .replaceAll(" ", "")
              .includes(
                filter.search
                  .toLowerCase()
                  .replaceAll("-", "")
                  .replaceAll(" ", ""),
              )) &&
          filter.difficulty[problem.difficulty] &&
          problem.tags.some((tag) => filter.tags.has(tag)),
      )
      .sort((a, b) => {
        if (sortOptions.difficulty === "asc" && a.difficulty !== b.difficulty) {
          return (
            difficulties.indexOf(a.difficulty) -
            difficulties.indexOf(b.difficulty)
          )
        } else if (
          sortOptions.difficulty === "desc" &&
          a.difficulty !== b.difficulty
        ) {
          return (
            difficulties.indexOf(b.difficulty) -
            difficulties.indexOf(a.difficulty)
          )
        }
        return sortOptions.id === "asc" ? a.id - b.id : b.id - a.id
      })
  }, [filter, problems, sortOptions])

  const filtersComponent = (
    <div className="flex w-60 flex-col gap-4">
      <div className="text-center text-xl font-bold text-neutral-500">
        FILTERS
      </div>
      <Card className="px-4 py-2">
        <div className="text-center text-sm font-semibold text-neutral-400">
          OPTIONS
        </div>
        <div className="my-2 flex flex-col items-center justify-center gap-4">
          <div className="relative">
            <Input
              className="h-8 text-neutral-500 placeholder:text-neutral-400 dark:bg-black"
              placeholder="Search"
              value={filter.search}
              onChange={(e) => {
                setFilter((prev) => ({ ...prev, search: e.target.value }))
              }}
            />
            <PiMagnifyingGlass className="absolute top-1/2 right-2 -translate-y-1/2 text-neutral-400" />
          </div>
          <BadgeCheckbox
            value={options.showTags}
            onValueChange={(val) => {
              setOptions((prev) => ({
                ...prev,
                showTags: val,
              }))
            }}
            className="bg-neutral-800 text-white hover:bg-neutral-700 dark:hover:bg-neutral-900"
          >
            Show Tags
          </BadgeCheckbox>
        </div>
      </Card>
      <Card className="px-4 py-2">
        <div className="text-center text-sm font-semibold text-neutral-400">
          SORT BY
        </div>
        <div className="my-2 flex items-center justify-center gap-2">
          <BadgeButton
            className="flex grow gap-2"
            onClick={() => {
              setSortOptions((prev) => ({
                ...prev,
                id: prev.id === "asc" ? "desc" : "asc",
              }))
            }}
          >
            {sortOptions.id === "asc" ? (
              <PiCaretDown />
            ) : sortOptions.id === "desc" ? (
              <PiCaretUp />
            ) : (
              <PiMinus />
            )}
            <div className="grow text-center">ID</div>
          </BadgeButton>
          <BadgeButton
            className="flex grow gap-2"
            onClick={() => {
              setSortOptions((prev) => ({
                ...prev,
                difficulty:
                  prev.difficulty === "asc"
                    ? "desc"
                    : prev.difficulty === "desc"
                      ? undefined
                      : "asc",
              }))
            }}
          >
            {sortOptions.difficulty === "asc" ? (
              <PiCaretDown />
            ) : sortOptions.difficulty === "desc" ? (
              <PiCaretUp />
            ) : (
              <PiMinus />
            )}
            <div className="grow text-center">Difficulty</div>
          </BadgeButton>
        </div>
      </Card>
      <Card className="px-4 py-2">
        <div className="text-center text-sm font-semibold text-neutral-400">
          DIFFICULTY
        </div>
        <div className="my-2 flex flex-col items-center gap-2">
          {difficulties.map((d) => (
            <BadgeCheckbox
              key={d}
              value={filter.difficulty[d]}
              onValueChange={(val) => {
                setFilter((prev) => ({
                  ...prev,
                  difficulty: { ...prev.difficulty, [d]: val },
                }))
              }}
              className={cn({
                "bg-emerald-100 text-emerald-600 hover:bg-emerald-200 dark:bg-emerald-800 dark:text-emerald-400 dark:hover:bg-emerald-900":
                  d === "easy",
                "bg-orange-100 text-orange-600 hover:bg-orange-200 dark:bg-orange-800 dark:text-orange-400 dark:hover:bg-orange-900":
                  d === "medium",
                "bg-rose-100 text-rose-600 hover:bg-rose-200 dark:bg-rose-800 dark:text-rose-400 dark:hover:bg-rose-900":
                  d === "hard",
              })}
            >
              {d}
            </BadgeCheckbox>
          ))}
        </div>
      </Card>
      <Card className="px-4 py-2">
        <div className="text-center text-sm font-semibold text-neutral-400">
          TAGS
        </div>
        <div className="flex justify-between px-4">
          <button
            className="cursor-pointer text-xs text-neutral-300 transition-all hover:text-neutral-400 hover:underline dark:text-neutral-700 dark:hover:text-neutral-600"
            onClick={() => {
              setFilter((prev) => ({
                ...prev,
                tags: new Set(tags),
              }))
            }}
          >
            Select All
          </button>
          <button
            className="cursor-pointer text-xs text-neutral-300 transition-all hover:text-neutral-400 hover:underline dark:text-neutral-700 dark:hover:text-neutral-600"
            onClick={() => {
              setFilter((prev) => ({
                ...prev,
                tags: new Set(),
              }))
            }}
          >
            Clear All
          </button>
        </div>
        <div className="my-2 flex flex-wrap items-center justify-center gap-2">
          {tags.map((t) => (
            <BadgeCheckbox
              key={t}
              value={filter.tags.has(t)}
              onValueChange={(val) => {
                setFilter((prev) => ({
                  ...prev,
                  tags: new Set(
                    val
                      ? [...prev.tags, t]
                      : [...prev.tags].filter((tag) => tag !== t),
                  ),
                }))
              }}
              className="w-16"
            >
              {t}
            </BadgeCheckbox>
          ))}
        </div>
      </Card>
    </div>
  )

  return (
    <>
      <div className="flex items-center justify-between">
        <div className="flex flex-col">
          <div className="mt-4 font-clash-display text-2xl font-semibold">
            Problems
          </div>
          <div className="mb-4 font-clash-display text-sm text-neutral-500 md:text-base">
            Browse all problems and filter by tags.
          </div>
        </div>
        <MobileContainer className="w-fit">
          <Dialog>
            <DialogTrigger asChild>
              <Button className="px-2 py-2" variant="outline">
                <PiFunnelDuotone className="size-6" />
              </Button>
            </DialogTrigger>
            <DialogContent className="w-fit">{filtersComponent}</DialogContent>
          </Dialog>
        </MobileContainer>
      </div>
      <div className="flex gap-4">
        <Problems problems={filteredProblems} showTags={options.showTags} />
        <DesktopContainer className="w-fit">
          {filtersComponent}
        </DesktopContainer>
      </div>
    </>
  )
}

export function ProblemListSkeleton() {
  return (
    <div className="flex gap-4">
      <div className="flex h-fit w-full flex-col divide-y divide-neutral-400 overflow-hidden rounded-xl border border-neutral-400 dark:divide-neutral-800 dark:border-neutral-800">
        <div className="flex divide-x divide-neutral-400 border-b bg-gray-50 font-semibold *:p-2 dark:divide-neutral-800 dark:bg-neutral-900">
          <div className="w-20 text-center">#</div>
          <div className="flex grow items-center justify-between">
            <p className="grow">Title</p>
          </div>
          <div className="w-10 text-center lg:w-20">Status</div>
        </div>
        <div className="divide-y">
          {Array.from({ length: 10 }).map((_, idx) => (
            <ProblemSkeleton key={idx} />
          ))}
        </div>
      </div>
      <div className="flex w-60 flex-col gap-4">
        <div className="text-center text-xl font-bold text-neutral-500">
          FILTERS
        </div>
        <Card className="px-4 py-2">
          <div className="text-center text-sm font-semibold text-neutral-400">
            OPTIONS
          </div>
          <div className="my-2 flex flex-col items-center justify-center gap-2">
            <div className="relative">
              <Input
                className="h-8 text-neutral-500 placeholder:text-neutral-400"
                placeholder="Search"
              />
              <PiMagnifyingGlass className="absolute top-1/2 right-2 -translate-y-1/2 text-neutral-400" />
            </div>
          </div>
        </Card>
        <Card className="px-4 py-2">
          <div className="text-center text-sm font-semibold text-neutral-400">
            DIFFICULTY
          </div>
          <div className="my-2 flex flex-col items-center gap-2"></div>
        </Card>
        <Card className="px-4 py-2">
          <div className="text-center text-sm font-semibold text-neutral-400">
            TAGS
          </div>
        </Card>
      </div>
    </div>
  )
}

function ProblemSkeleton() {
  return (
    <div className="flex cursor-pointer divide-x transition-colors *:p-2 hover:bg-gray-100 dark:bg-neutral-950">
      <div className="flex w-20 animate-pulse items-center justify-center font-geist-mono">
        <div className="h-6 w-8 animate-pulse bg-neutral-100 dark:bg-neutral-800"></div>
      </div>
      <div className="flex grow flex-col">
        <div className="flex h-6 w-40 animate-pulse items-center justify-between bg-neutral-100 px-2 dark:bg-neutral-800" />
      </div>
      <div className="w-10 lg:w-20"></div>
    </div>
  )
}
