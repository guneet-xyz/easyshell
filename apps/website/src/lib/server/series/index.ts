import { getSeries as getGeneratedSeries } from "@easyshell/data/series"

export async function getAllSeries() {
  return getGeneratedSeries()
}

export async function getSeriesForProblem(problemId: string) {
  const series = getGeneratedSeries()
    .filter((s) =>
      s.sections.some((section) => section.problems.includes(problemId)),
    )
    .map((s) => ({
      id: s.id,
      name: s.name,
    }))
  return series
}

export async function getSeries(id: string) {
  const series = getGeneratedSeries().find((s) => s.id === id)
  return series ?? null
}
