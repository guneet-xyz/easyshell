import Link from "next/link"

import { getWikiPages } from "@/lib/server/wiki"
import { cn } from "@/lib/utils"

export async function ProblemEditorial({ slug }: { slug: string }) {
  const wikiPages = await getWikiPages()
  const editorial = wikiPages.find(
    (page) => page.slug === slug && page.type === "editorial",
  )

  return (
    <div className="mt-2 text-center font-clash-display text-neutral-500">
      <span className={cn({ "opacity-0": !editorial })}>{`Need Help? `}</span>
      {editorial ? (
        <Link href={`/wiki/${editorial.slug}`} prefetch={true}>
          <span className="underline-offset-4 hover:underline">{`View the Editorial!`}</span>
        </Link>
      ) : null}
    </div>
  )
}
