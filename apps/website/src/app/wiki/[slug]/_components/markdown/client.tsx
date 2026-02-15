"use client"

import { ProblemLink } from "@/components/problem-link/client"
import { WikiLink } from "@/components/wiki-link/client"
import { customComponents } from "@/mdx-components"

import { MDXRemote, type MDXRemoteSerializeResult } from "next-mdx-remote"

const wikiComponents: typeof customComponents = {
  ...customComponents,
  h2: ({ children }) => <h2 className="mt-6 text-3xl font-bold">{children}</h2>,
  h3: ({ children }) => <h3 className="mt-6 text-xl font-bold">{children}</h3>,
  ul: ({ children }) => (
    <ul className="list-inside list-disc pl-4">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="list-inside list-decimal pl-4">{children}</ol>
  ),
  ProblemLink: ({ slug }: { slug: string }) => <ProblemLink slug={slug} />,
  WikiLink: ({ slug }: { slug: string }) => <WikiLink slug={slug} />,
}

export default function MarkdownClient({
  source,
}: {
  source: MDXRemoteSerializeResult
}) {
  return <MDXRemote {...source} components={wikiComponents} />
}
