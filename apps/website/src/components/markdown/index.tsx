import { serialize } from "next-mdx-remote/serialize"

import { MarkdownClient } from "./dynamic"

export async function Markdown({ source }: { source: string }) {
  const serialized = await serialize(source)
  return <MarkdownClient source={serialized} />
}
