import { MarkdownClient } from "./dynamic"

import { serialize } from "next-mdx-remote/serialize"

export async function Markdown({ source }: { source: string }) {
  const serialized = await serialize(source)
  return <MarkdownClient source={serialized} />
}
