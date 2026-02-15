"use client"

import dynamic from "next/dynamic"

export { usePromptSettingsContext } from "./component"

export const PromptSettingsContextProvider = dynamic(
  () => import("./component").then((mod) => mod.PromptSettingsContextProvider),
  { ssr: false },
)

export const PromptSettings = dynamic(
  () => import("./component").then((mod) => mod.PromptSettings),
  { ssr: false },
)
