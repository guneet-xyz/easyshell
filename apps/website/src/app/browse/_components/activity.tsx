import Link from "next/link"
import { PiBookmarkSimpleDuotone } from "react-icons/pi"

import { ProblemBookmark } from "@/app/problems/[problemSlug]/_components/problem/bookmark"
import { DesktopContainer } from "@/components/media"
import { AlternativeProblemStatus } from "@/components/problem-status"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  getProblemSlugFromId,
  getPublicProblemInfo,
} from "@/lib/server/problems"
import { min } from "@/lib/utils"

export async function RecentActivity({
  bookmarks,
  attempted,
  loggedIn,
}: {
  bookmarks: Array<number>
  attempted: Array<string>
  loggedIn: boolean
}) {
  if (!loggedIn) {
    return (
      <DesktopContainer className="h-fit w-fit">
        <div className="min-w-60">
          <div className="font-clash-display text-2xl font-semibold">
            Recent Activity
          </div>
          <div className="mb-4 font-clash-display text-sm text-neutral-500 md:text-base">
            Pick up where you left off
          </div>
          <div className="flex h-40 w-60 items-center justify-center rounded-2xl border border-dashed border-neutral-400 p-4 text-sm text-neutral-500 dark:border-neutral-600">
            Login to see your activity
          </div>
        </div>
      </DesktopContainer>
    )
  }

  const bookmarks_end = min(4, bookmarks.length)
  const attempted_end = min(4 - bookmarks_end, attempted.length)

  const hidden_items =
    bookmarks.length +
    attempted.length -
    min(5, bookmarks.length + attempted.length)

  return (
    <div className="min-w-60">
      <div className="font-clash-display text-2xl font-semibold">
        Recent Activity
      </div>
      <div className="mb-4 font-clash-display text-sm text-neutral-500 md:text-base">
        Pick up where you left off
      </div>
      <div className="flex flex-col gap-2">
        {bookmarks.length === 0 ? (
          <div>Your bookmarks will show up here</div>
        ) : (
          <>
            {bookmarks.slice(0, bookmarks_end).map((id) => (
              <BookmarkedProblem key={id} id={id} />
            ))}
            {attempted.slice(0, attempted_end).map((id) => (
              <AttemptedProblem key={id} slug={id} />
            ))}
          </>
        )}
        <Expand
          text={
            hidden_items === 0
              ? `See more info`
              : `See ${hidden_items} more items`
          }
          bookmarks={bookmarks}
          attempted={attempted}
        />
      </div>
    </div>
  )
}

async function Expand({
  text,
  bookmarks,
  attempted,
}: {
  text: string
  bookmarks: Array<number>
  attempted: Array<string>
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <div className="cursor-pointer rounded-md border border-neutral-400 bg-neutral-200/70 py-1 text-center text-sm text-neutral-800 shadow transition-colors hover:bg-neutral-300 dark:border-neutral-700 dark:bg-neutral-800/70 dark:text-neutral-200 dark:hover:bg-neutral-700/50">
          {text}
        </div>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Recent Activity</DialogTitle>
          <DialogDescription>Pick up where you left off.</DialogDescription>
        </DialogHeader>
        <div>
          <div className="font-medium">Bookmarked</div>
          <div className="mb-4 text-sm dark:text-neutral-400">
            These are all the problems you have bookmarked.
          </div>
          <div className="flex flex-col gap-2">
            {bookmarks.map((id) => (
              <BookmarkedProblemExpanded key={id} id={id} />
            ))}
          </div>
          <div className="mt-4 font-medium">Recently Attempted</div>
          <div className="mb-4 text-sm dark:text-neutral-400">
            These are the problems you have attempted but not solved yet.
          </div>
          <div className="flex flex-col gap-2">
            {attempted.map((id) => (
              <AttemptedProblemExpanded key={id} slug={id} />
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

async function BookmarkedProblem({ id }: { id: number }) {
  const slug = await getProblemSlugFromId(id)
  const { title } = await getPublicProblemInfo(slug)
  return (
    <Link
      prefetch={true}
      href={`/problems/${slug}`}
      className="flex items-center rounded-md border py-1 shadow hover:bg-neutral-100 dark:hover:bg-neutral-800/50"
    >
      <div className="px-1">
        <PiBookmarkSimpleDuotone className="size-6 dark:text-neutral-500" />
      </div>
      <div className="overflow-hidden text-sm overflow-ellipsis whitespace-nowrap dark:text-neutral-200">
        {title}
      </div>
      <div className="ml-auto pr-2 font-clash-display text-sm font-medium text-neutral-300 dark:text-neutral-700">
        #{id}
      </div>
    </Link>
  )
}

async function BookmarkedProblemExpanded({ id }: { id: number }) {
  const slug = await getProblemSlugFromId(id)
  const { title } = await getPublicProblemInfo(slug)
  return (
    <div className="flex items-center overflow-hidden rounded-md border shadow">
      <div className="flex items-center justify-center border-r px-1 py-0.5 dark:bg-neutral-900">
        <ProblemBookmark
          problemId={id}
          isBookmarked={true}
          className="size-6 dark:text-neutral-500"
        />
      </div>
      <Link
        href={`/problems/${slug}`}
        className="flex h-full grow items-center px-2 py-1 hover:bg-neutral-100 dark:hover:bg-neutral-800/50"
      >
        <div className="h-full overflow-hidden text-sm overflow-ellipsis whitespace-nowrap dark:text-neutral-200">
          {title}
        </div>
        <div className="ml-auto h-full font-clash-display text-sm font-medium text-neutral-300 dark:text-neutral-700">
          #{id}
        </div>
      </Link>
    </div>
  )
}

async function AttemptedProblem({ slug }: { slug: string }) {
  const { id, title } = await getPublicProblemInfo(slug)
  return (
    <Link
      href={`/problems/${slug}`}
      className="flex items-center rounded-md border py-1 shadow hover:bg-neutral-100 dark:hover:bg-neutral-800/50"
    >
      <div className="px-1">
        <AlternativeProblemStatus
          status="attempted"
          className="size-6 dark:text-neutral-500"
        />
      </div>
      <div className="overflow-hidden text-sm overflow-ellipsis whitespace-nowrap dark:text-neutral-200">
        {title}
      </div>
      <div className="ml-auto pr-2 font-clash-display text-sm font-medium text-neutral-300 dark:text-neutral-700">
        #{id}
      </div>
    </Link>
  )
}

async function AttemptedProblemExpanded({ slug }: { slug: string }) {
  const { id, title } = await getPublicProblemInfo(slug)
  return (
    <div className="flex items-center overflow-hidden rounded-md border shadow">
      <div className="flex items-center justify-center border-r px-1 py-0.5 dark:bg-neutral-900">
        <AlternativeProblemStatus
          status="attempted"
          className="size-6 dark:text-neutral-500"
          showTooltip
        />
      </div>
      <Link
        prefetch={true}
        href={`/problems/${slug}`}
        className="flex h-full grow items-center px-2 py-1 hover:bg-neutral-100 dark:hover:bg-neutral-800/50"
      >
        <div className="h-full overflow-hidden text-sm overflow-ellipsis whitespace-nowrap dark:text-neutral-200">
          {title}
        </div>
        <div className="ml-auto h-full font-clash-display text-sm font-medium text-neutral-300 dark:text-neutral-700">
          #{id}
        </div>
      </Link>
    </div>
  )
}
