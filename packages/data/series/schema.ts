import z from "zod";

export const SeriesSchema = z.object({
  slug: z.string(),
  name: z.string(),
  image: z.string(),
  description: z.string(),
  sections: z.array(z.object({
    title: z.string(),
    description: z.string(),
    problems: z.array(z.string())
  }))
})

export type Series = z.infer<typeof SeriesSchema>
