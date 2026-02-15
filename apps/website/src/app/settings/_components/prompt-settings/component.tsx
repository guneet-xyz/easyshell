"use client"

import { Switch } from "@/components/ui/switch"
import type { SetState } from "@/lib/client"

import { createContext, useContext, useEffect, useState } from "react"

export function PromptSettings() {
  const { multiline, setMultiline } = usePromptSettingsContext()
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Multi-Line Submission Prompt
        </p>
        <p className="text-sm text-gray-500">
          Give yourself more space to write your submission commands.
        </p>
      </div>
      <Switch checked={multiline} onCheckedChange={setMultiline} />
    </div>
  )
}

const promptSettingsContext = createContext<{
  multiline: boolean
  setMultiline: SetState<boolean>
} | null>(null)

export const usePromptSettingsContext = () => {
  const context = useContext(promptSettingsContext)
  if (!context) {
    throw new Error(
      "usePromptSettingsContext must be used within a PromptSettingsProvider",
    )
  }
  return context
}

export function PromptSettingsContextProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [multiline, setMultiline] = useState(
    localStorage.getItem("multiline") === "true",
  )

  useEffect(() => {
    localStorage.setItem("multiline", multiline.toString())
  }, [multiline])

  return (
    <promptSettingsContext.Provider value={{ multiline, setMultiline }}>
      {children}
    </promptSettingsContext.Provider>
  )
}
