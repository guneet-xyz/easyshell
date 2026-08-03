import z from "zod"

export const WikiFrontmatterSchema = z.object({
  title: z.string(),
  type: z.enum(["editorial"]),
})

export const WikiSchema = WikiFrontmatterSchema.extend({
  id: z.string(),
  body: z.string(),
  lastEdited: z.number(),
})

export type Wiki = z.infer<typeof WikiSchema>

export const GeneratedWikiDataSchema = z.array(WikiSchema)
export type GeneratedWikiData = z.infer<typeof GeneratedWikiDataSchema>
