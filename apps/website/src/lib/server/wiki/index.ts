import { getWikis } from "@easyshell/data/wiki"

export async function getWikiPages() {
  return getWikis().map((wiki) => ({
    slug: wiki.id.replace(/\.mdx$/, ""),
    title: wiki.title,
    type: wiki.type,
    body: wiki.body,
    lastEdited: wiki.lastEdited,
  }))
}

export async function getWikiMetadata(slug: string) {
  const page = (await getWikiPages()).find((wiki) => wiki.slug === slug)
  if (!page) return null
  return {
    title: page.title,
    type: page.type,
    lastEdited: page.lastEdited,
  }
}

export async function getWikiFull(slug: string) {
  const page = (await getWikiPages()).find((wiki) => wiki.slug === slug)
  return page ?? null
}
