import { PROJECT_ROOT, lastModified, writeJsonToJs } from "@easyshell/utils/build"
import {readdir, readFile} from "fs/promises"
import { GeneratedWikiData, WikiFrontmatterSchema } from "./schema"

import matter from "gray-matter"

const WIKI_DATA_FOLDER = `${PROJECT_ROOT}/packages/data/wiki/_data`
const GENERATED_JS = `${PROJECT_ROOT}/packages/data/wiki/generated.js`

export async function generateWikiData() {
  const files = await readdir(WIKI_DATA_FOLDER)
  const wikis : GeneratedWikiData = []
  for (const file of files) {
    const out = matter(await readFile(`${WIKI_DATA_FOLDER}/${file}`))

    const {data: frontmatter, success} = WikiFrontmatterSchema.safeParse(out.data)

    if (!success) { throw new Error(`Failed to parse wiki frontmatter for ${file}`) }

    const lastEdited = await lastModified(`${WIKI_DATA_FOLDER}/${file}`)

    wikis.push({
    id: file,
    ...frontmatter,
    body: out.content,
    lastEdited,
    })
  }

  await writeJsonToJs(GENERATED_JS, wikis)
}

