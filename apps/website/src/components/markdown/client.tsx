"use client"

import { MDXRemote, type MDXRemoteSerializeResult } from "next-mdx-remote"

import { customComponents } from "@/mdx-components"

export default function MarkdownClient({
  source,
}: {
  source: MDXRemoteSerializeResult
}) {
  return <MDXRemote {...source} components={customComponents} />
}
