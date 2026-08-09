"use client"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useEffect } from "react"

export function ProblemPageTabs({
  tabs,
  defaultValue,
}: {
  tabs: Array<{ title: string; value: string; content: React.ReactNode }>
  defaultValue: string
}) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const tab = searchParams.get("tab") ?? defaultValue

  useEffect(() => {
    for (const { value } of tabs) {
      router.prefetch(`${pathname}?tab=${value}`)
    }
  }, [tabs, pathname, router])

  function setTab(newTab: string) {
    router.replace(`${pathname}?tab=${newTab}`)
  }
  return (
    <Tabs
      defaultValue={defaultValue}
      value={tab}
      onValueChange={setTab}
      className="flex h-full flex-col"
    >
      <TabsList className="w-full">
        {tabs.map(({ title, value }) => (
          <TabsTrigger key={value} value={value} className="text-md grow">
            {title}
          </TabsTrigger>
        ))}
      </TabsList>
      {tabs.map(({ value, content }) => (
        <TabsContent key={value} value={value} className="grow">
          {content}
        </TabsContent>
      ))}
    </Tabs>
  )
}
