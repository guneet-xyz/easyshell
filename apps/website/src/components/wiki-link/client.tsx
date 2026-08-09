"use client"

import { getWikiMetadata } from "@/lib/server/actions/get-wiki-metadata"

import { WikiLinkBase } from "."

import { useEffect, useState } from "react"

export function WikiLink({
  id,
  className,
}: {
  id: string
  className?: string
}) {
  const [metadata, setMetadata] =
    useState<Awaited<ReturnType<typeof getWikiMetadata>>>(null)

  useEffect(() => {
    void (async () => {
      setMetadata(await getWikiMetadata(id))
    })()
  }, [id])

  return <WikiLinkBase id={id} metadata={metadata} className={className} />
}
