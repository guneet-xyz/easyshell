"use client"

import dynamic from "next/dynamic"

export const SubmissionsChart = dynamic(() => import("./component"), {
  ssr: false,
})
