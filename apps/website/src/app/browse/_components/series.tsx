"use client"

import Autoplay from "embla-carousel-autoplay"
import Link from "next/link"
import { useEffect, useState } from "react"

import { TextBackground } from "@/components/backgrounds/text-background"
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from "@/components/ui/carousel"
import { Progress } from "@/components/ui/progress"
import type { getUserSubmissionStats } from "@/lib/server/queries"
import type { getAllSeries } from "@/lib/server/series"
import { cn } from "@/lib/utils"

export function SeriesCarousel({
  submission_stats,
  allSeries,
}: {
  submission_stats: Awaited<ReturnType<typeof getUserSubmissionStats>> | null
  allSeries: Awaited<ReturnType<typeof getAllSeries>>
}) {
  const [emblaApi, setEmblaApi] = useState<CarouselApi>()

  const [canScrollNext, setCanScrollNext] = useState(false)
  const [canScrollPrev, setCanScrollPrev] = useState(false)

  useEffect(() => {
    if (!emblaApi) return
    function updateScrollStatus() {
      if (!emblaApi) return
      setCanScrollNext(emblaApi.canScrollNext())
      setCanScrollPrev(emblaApi.canScrollPrev())
    }
    emblaApi.on("select", updateScrollStatus)
    emblaApi.on("init", updateScrollStatus)
    emblaApi.on("reInit", updateScrollStatus)
    emblaApi.on("resize", updateScrollStatus)
    emblaApi.on("settle", updateScrollStatus)
    return () => {
      emblaApi.off("select", updateScrollStatus)
      emblaApi.off("init", updateScrollStatus)
      emblaApi.off("reInit", updateScrollStatus)
      emblaApi.off("resize", updateScrollStatus)
      emblaApi.off("settle", updateScrollStatus)
    }
  }, [emblaApi])

  return (
    <Carousel
      setApi={setEmblaApi}
      opts={{
        align: "start",
      }}
      plugins={[
        Autoplay({
          delay: 2000,
        }),
      ]}
    >
      <CarouselContent className="pb-6">
        {allSeries.map((series) => (
          <CarouselItem key={series.slug} className="basis-auto">
            <SeriesCard
              series={series}
              num_solved={
                new Set(
                  series.sections
                    .map((s) =>
                      s.problems.filter((p) =>
                        submission_stats
                          ? submission_stats.problems[p] === "solved"
                          : false,
                      ),
                    )
                    .flat(),
                ).size
              }
            />
          </CarouselItem>
        ))}
      </CarouselContent>
      <CarouselPrevious
        className={cn("hidden md:flex", {
          "md:hidden": !canScrollPrev,
        })}
      />
      <CarouselNext
        className={cn("hidden md:flex", {
          "md:hidden": !canScrollNext,
        })}
      />
    </Carousel>
  )
}

function SeriesCard({
  series,
  num_solved,
}: {
  series: Awaited<ReturnType<typeof getAllSeries>>[number]
  num_solved: number
}) {
  const progress = Math.round(
    (num_solved * 100) /
      new Set(series.sections.map((s) => s.problems).flat()).size,
  )
  return (
    <Link
      href={`/series/${series.slug}`}
      key={series.slug}
      className="flex w-60 flex-col overflow-hidden rounded-xl border shadow-lg transition-colors hover:bg-neutral-50 dark:bg-neutral-950/75 dark:hover:bg-black"
    >
      <TextBackground text={series.slug} className="h-18" />
      <div className="flex flex-col px-4 py-2">
        <div className="flex items-center justify-between">
          <div className="font-clash-display font-semibold">{series.name}</div>
          <div className="font-geist-mono text-sm font-semibold">
            {progress}%
          </div>
        </div>
        <div className="text-justify text-sm text-neutral-600 dark:text-neutral-500">
          {series.description}
        </div>
        <Progress
          className="my-2 bg-emerald-100 *:bg-emerald-600 dark:bg-emerald-950 dark:*:bg-emerald-800"
          value={progress}
        />
      </div>
    </Link>
  )
}

export function SeriesCardSkeleton({
  series,
}: {
  series: Awaited<ReturnType<typeof getAllSeries>>[number]
}) {
  return (
    <Link
      href={`/series/${series.slug}`}
      key={series.slug}
      className="flex w-60 flex-col overflow-hidden rounded-xl border transition-colors hover:bg-neutral-50 dark:bg-neutral-950"
    >
      <div className="h-18 animate-pulse bg-neutral-100 dark:bg-stone-900"></div>
      <div className="flex flex-col px-4 py-2">
        <div className="flex items-center justify-between">
          <div className="font-clash-display font-semibold">{series.name}</div>
        </div>
        <div className="text-justify text-sm text-neutral-600">
          {series.description}
        </div>
        <Progress
          className="my-2 animate-pulse bg-emerald-100 dark:bg-emerald-950 dark:*:bg-emerald-800"
          value={0}
        />
      </div>
    </Link>
  )
}
