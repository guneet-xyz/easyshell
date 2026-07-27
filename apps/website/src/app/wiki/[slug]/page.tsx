import { Footer } from "@/components/footer"
import { ProblemLink } from "@/components/problem-link/server"
import { getWikiFull, getWikiMetadata } from "@/lib/server/wiki"

import { Markdown } from "./_components/markdown"

import moment from "moment"
import { notFound } from "next/navigation"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const metadata = await getWikiMetadata(slug)
  if (!metadata)
    return {
      title: "easyshell - not found",
    }

  if (metadata.type === "editorial")
    return {
      title: `editorial - ${slug}`,
    }

  return { title: `wiki - ${slug}` }
}

export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const metadata = await getWikiFull(slug)
  if (!metadata) notFound()

  return (
    <>
      <div className="mx-auto flex w-[95%] flex-col md:w-[90%] lg:w-2/3">
        <div className="flex flex-col justify-center py-8">
          <div className="font-clash-display text-5xl font-bold">
            {metadata.title}
          </div>
          <div className="font-clash-display flex justify-between text-neutral-500">
            <div>{moment(metadata.lastEdited).format("MMMM Do YYYY")}</div>
            <div>{metadata.type === "editorial" ? "EDITORIAL" : null}</div>
          </div>
        </div>
        {metadata.type === "editorial" ? <SpoilerWarning slug={slug} /> : null}
        <div>
          <Markdown source={metadata.body} />
        </div>
      </div>
      <Footer className="mt-8" />
    </>
  )
}

export async function SpoilerWarning({ slug }: { slug: string }) {
  return (
    <div className="mb-4 bg-neutral-100 px-4 py-2 text-center dark:bg-neutral-800">
      <span className="font-clash-display font-semibold text-neutral-700 dark:text-neutral-300">
        {`SPOILER WARNING: `}
      </span>
      <span className="font-clash-display text-neutral-700 dark:text-neutral-300">
        {`This wiki page contains spoilers for the problem `}
      </span>
      <ProblemLink slug={slug} />
    </div>
  )
}
