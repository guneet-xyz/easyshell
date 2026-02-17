"use client"

import dynamic from "next/dynamic"
import posthog from "posthog-js"
import { PostHogProvider as PHProvider } from "posthog-js/react"
import { useEffect } from "react"

const PostHogPageView = dynamic(() => import("./posthog-pageview"), {
  ssr: false,
})

export function ClientSideProviders({
  children,
}: {
  children: React.ReactNode
}) {
  useEffect(() => {
    if (
      !process.env.NEXT_PUBLIC_POSTHOG_KEY ||
      !process.env.NEXT_PUBLIC_POSTHOG_HOST
    ) {
      return
    }
    posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
      api_host: "/ph",
      ui_host: "https://us.posthog.com",
      capture_pageview: true,
      capture_pageleave: true,
      capture_performance: true,
      capture_dead_clicks: true,
      capture_heatmaps: true,
      capture_exceptions: true,
    })
  }, [])

  return (
    <PHProvider client={posthog}>
      <PostHogPageView />
      {children}
    </PHProvider>
  )
}
