import { getWikis } from "@easyshell/data/wiki"

export async function getWikiPages() {
  return getWikis().map((wiki) => ({
    id: wiki.id.replace(/\.mdx$/, ""),
    title: wiki.title,
    type: wiki.type,
    body: wiki.body,
    lastEdited: wiki.lastEdited,
  }))
}

export async function getWikiMetadata(id: string) {
  const page = (await getWikiPages()).find((wiki) => wiki.id === id)
  if (!page) return null
  return {
    title: page.title,
    type: page.type,
    lastEdited: page.lastEdited,
  }
}

export async function getWikiFull(id: string) {
  const page = (await getWikiPages()).find((wiki) => wiki.id === id)
  return page ?? null
}
