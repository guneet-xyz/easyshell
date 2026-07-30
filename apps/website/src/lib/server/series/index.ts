import { getSeries as getGeneratedSeries } from "@easyshell/data/series"

export async function getAllSeries() {
  return getGeneratedSeries()
}

export async function getSeriesForProblem(problemSlug: string) {
  const series = getGeneratedSeries()
    .filter((s) =>
      s.sections.some((section) => section.problems.includes(problemSlug)),
    )
    .map((s) => ({
      slug: s.slug,
      name: s.name,
    }))
  return series
}

export async function getSeries(slug: string) {
  const series = getGeneratedSeries().find((s) => s.slug === slug)
  return series ?? null
}
