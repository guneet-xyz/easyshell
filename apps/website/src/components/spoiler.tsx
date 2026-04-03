"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

export function Spoiler({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)

  const toggle = () => {
    setOpen(!open)
  }

  return (
    <div
      className={cn("relative", { "cursor-pointer": !open }, className)}
      onClick={toggle}
    >
      <div
        className={cn(
          "absolute top-1/2 left-1/2 z-10 -translate-x-1/2 -translate-y-1/2 text-sm font-semibold",
          { hidden: open },
        )}
      >
        Spoiler
      </div>
      <div className={cn("blur-sm", { "blur-none": open })}>{children}</div>
    </div>
  )
}
