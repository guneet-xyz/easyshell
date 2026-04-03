import Link from "next/link"

import { Spoiler } from "@/components/spoiler"
import { Badge } from "@/components/ui/badge"
import { getProblemMetadata } from "@/lib/server/problems"

export async function ProblemAbout({ slug }: { slug: string }) {
  const { tags, series } = await getProblemMetadata(slug)
  return (
    <div className="mx-4 mt-8 border-t dark:text-gray-300">
      <div className="mt-6 mb-4 text-xl font-bold">About this problem</div>
      <div className="divide-y divide-neutral-300 rounded-md border border-neutral-300 bg-neutral-50 dark:divide-neutral-700 dark:border-neutral-700 dark:bg-neutral-950/50">
        <div className="flex items-center gap-2">
          <div className="w-20 px-2 text-sm font-semibold">Tags</div>
          <Spoiler className="grow border-l border-neutral-300 dark:border-neutral-700">
            <div className="flex items-center gap-4 px-4 pt-1.5 pb-2">
              {tags.map((tag, i) => (
                <Badge key={i}>{tag}</Badge>
              ))}
            </div>
          </Spoiler>
        </div>
        {series.length > 0 ? (
          <div className="flex items-center gap-2">
            <div className="w-20 px-2 text-sm font-semibold">Series</div>

            <div className="flex items-center gap-4 border-l border-neutral-300 px-4 pt-1 pb-2 dark:border-neutral-700">
              {series.map((s) => (
                <Link key={s.slug} href={`/series/${s.slug}`} prefetch={true}>
                  <Badge>{s.name}</Badge>
                </Link>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
