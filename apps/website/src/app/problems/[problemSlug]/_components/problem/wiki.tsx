import { getWikiPages } from "@/lib/server/wiki"

import moment from "moment"
import Link from "next/link"

export async function ProblemRelatedWiki({ slug }: { slug: string }) {
  const wikiPages = await getWikiPages()
  const editorial = wikiPages.find(
    (page) => page.slug === slug && page.type === "editorial",
  )

  const relatedWikiPages = [...(editorial ? [editorial] : [])]
  return (
    <div className="mx-4 mt-8 border-t dark:text-gray-300">
      <div className="mb-4 mt-6 text-xl font-bold">Related Wiki</div>
      {relatedWikiPages.length === 0 ? (
        <div>This problem does not have any related wiki pages.</div>
      ) : (
        <div>
          {relatedWikiPages.map((page) => (
            <WikiPage key={page.slug} page={page} />
          ))}
        </div>
      )}
    </div>
  )
}

function WikiPage({
  page,
}: {
  page: Awaited<ReturnType<typeof getWikiPages>>[number]
}) {
  return (
    <Link
      prefetch={true}
      href={`/wiki/${page.slug}`}
      className="flex flex-col rounded-md border bg-neutral-100 p-2 shadow transition-colors hover:bg-neutral-200/80 dark:bg-neutral-800 dark:hover:bg-neutral-700/50"
    >
      <div className="font-clash-display font-semibold">{page.title}</div>
      <div className="font-clash-display flex justify-between text-xs text-neutral-500">
        <div>{moment(page.lastEdited).format("MMMM Do YYYY")}</div>
        <div>{page.type === "editorial" ? "EDITORIAL" : null}</div>
      </div>
    </Link>
  )
}
