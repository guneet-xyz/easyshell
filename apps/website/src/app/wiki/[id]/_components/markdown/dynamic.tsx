"use client"

import dynamic from "next/dynamic"

export const MarkdownClient = dynamic(() => import("./client"), { ssr: false })
