"use client"

import { customComponents } from "@/mdx-components"

import { MDXRemote, type MDXRemoteSerializeResult } from "next-mdx-remote"

export default function MarkdownClient({
  source,
}: {
  source: MDXRemoteSerializeResult
}) {
  return <MDXRemote {...source} components={customComponents} />
}
