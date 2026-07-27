"use client"

import { EasyTooltip } from "@/components/ui/tooltip"
import { toggleBookmark } from "@/lib/server/actions/toggle-bookmark"
import { cn } from "@/lib/utils"

import { useState } from "react"
import { PiBookmarkSimple, PiBookmarkSimpleDuotone } from "react-icons/pi"
import { toast } from "sonner"

export function ProblemBookmark({
  problemId,
  isBookmarked,
  className,
}: {
  problemId: number
  isBookmarked: boolean
  className?: string
}) {
  const [bookmarked, setBookmarked] = useState(isBookmarked)
  const [inBetween, setInBetween] = useState(false)

  async function handle() {
    if (inBetween) return
    setInBetween(true)
    try {
      const resp = await toggleBookmark(problemId)
      if (!resp) {
        toast.error("Failed to toggle bookmark", {
          description: "Unauthenticated",
        })
        setInBetween(false)
        return
      }
      const { newBookmarkState } = resp
      if (newBookmarkState) toast.success("Problem Bookmarked")
      else toast.success("Bookmark Removed")
      setInBetween(false)
      setBookmarked(newBookmarkState)
    } catch {
      toast.error("Failed to toggle bookmark")
      setInBetween(false)
    }
  }

  return (
    <EasyTooltip
      tip={
        bookmarked
          ? inBetween
            ? "Removing Bookmark..."
            : "Remove Bookmark"
          : inBetween
            ? "Adding Bookmark..."
            : "Add Bookmark"
      }
    >
      <div
        className="group relative h-fit w-fit cursor-pointer"
        onClick={handle}
      >
        <PiBookmarkSimple className={cn("text-3xl", className)} />
        <PiBookmarkSimpleDuotone
          className={cn(
            "absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-3xl transition-opacity",
            {
              "opacity-0": !bookmarked,
              "opacity-25": inBetween && bookmarked,
              "opacity-75": inBetween && !bookmarked,
              "opacity-100": bookmarked,
            },
            className,
          )}
        />
      </div>
    </EasyTooltip>
  )
}
