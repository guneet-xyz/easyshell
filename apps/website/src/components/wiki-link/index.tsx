import moment from "moment"
import Link from "next/link"

import { EasyTooltip } from "@/components/ui/tooltip"
import type { getWikiMetadata } from "@/lib/server/actions/get-wiki-metadata"
import { cn } from "@/lib/utils"

export function WikiLinkBase({
  metadata,
  slug,
  className,
}: {
  metadata: Awaited<ReturnType<typeof getWikiMetadata>> | null
  slug: string
  className?: string
}) {
  return (
    <EasyTooltip
      dontInterceptClick
      tip={
        metadata ? (
          <div className="flex flex-col justify-center">
            <div className="font-clash-display text-2xl font-bold">
              {metadata.title}
            </div>
            <div className="flex justify-between font-clash-display text-xs text-neutral-500">
              <div>{moment(metadata.lastEdited).format("MMMM Do YYYY")}</div>
              <div>{metadata.type === "editorial" ? "EDITORIAL" : null}</div>
            </div>
          </div>
        ) : null
      }
    >
      <Link
        href={`/problems/${slug}`}
        className={cn(
          "ml-1 inline w-fit space-x-1 rounded-md border bg-neutral-100 px-2 py-1 whitespace-nowrap shadow-xs dark:bg-neutral-800",
          className,
        )}
        prefetch={true}
      >
        <span className="font-clash-display text-xs font-semibold text-neutral-400 dark:text-neutral-500">
          WIKI
        </span>
        <span className={cn("inline font-geist-mono text-xs font-medium", {})}>
          {slug}
        </span>
      </Link>
    </EasyTooltip>
  )
}
