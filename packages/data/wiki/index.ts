import data from "./generated.js"
import { GeneratedWikiDataSchema } from "./schema"

const parsedData = GeneratedWikiDataSchema.parse(data)

export function getWikis() {
  return [...parsedData].sort(
    (a, b) => b.lastEdited - a.lastEdited || a.id.localeCompare(b.id),
  )
}
