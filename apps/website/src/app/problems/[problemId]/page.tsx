import { DesktopContainer, MobileContainer } from "@/components/media"
import { getProblems } from "@/lib/server/problems"

import { LaptopView } from "./_components/laptop-view"
import { MobileView } from "./_components/mobile-view"
import { ProblemNotFound } from "./_components/not-found-page"

import type { Metadata } from "next"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ problemId: string }>
}): Promise<Metadata> {
  const { problemId } = await params
  return {
    title: `easyshell - ${problemId}`,
  }
}

export default async function Page({
  params,
}: {
  params: Promise<{ problemId: string }>
}) {
  const { problemId } = await params

  const valid = (await getProblems()).includes(problemId)

  if (!valid) {
    return <ProblemNotFound />
  }

  return (
    <>
      <DesktopContainer>
        <LaptopView problemId={problemId} />
      </DesktopContainer>
      <MobileContainer>
        <MobileView problemId={problemId} />
      </MobileContainer>
    </>
  )
}
