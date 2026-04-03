import { getAllSeries } from "@/lib/server/series"

import { ProblemListSkeleton } from "./_components/problems"
import { SeriesCardSkeleton } from "./_components/series"

export default async function Page() {
  const allSeries = await getAllSeries()

  return (
    <div className="flex flex-col">
      <div className="font-clash-display text-2xl font-semibold">Series</div>
      <div className="font-clash-display text-neutral-500">
        Curated list of problems to master specific topics.
      </div>
      <div className="mt-4 flex gap-4">
        {allSeries.map((series) => (
          <SeriesCardSkeleton key={series.slug} series={series} />
        ))}
      </div>
      <div className="mt-4 font-clash-display text-2xl font-semibold">
        Problems
      </div>
      <div className="mb-4 font-clash-display text-neutral-500">
        Browse all problems and filter by tags.
      </div>
      <ProblemListSkeleton />
    </div>
  )
}
