"use client"

import * as SeparatorPrimitive from "@radix-ui/react-separator"
import * as React from "react"

import { cn } from "@/lib/utils"

function Separator({
  className,
  orientation = "horizontal",
  decorative = true,
  children,
  ...props
}: React.ComponentProps<typeof SeparatorPrimitive.Root> & {
  children?: React.ReactNode
}) {
  return (
    <SeparatorPrimitive.Root
      data-slot="separator-root"
      decorative={decorative}
      orientation={orientation}
      className={cn(
        "shrink-0 bg-border data-[orientation=horizontal]:h-px data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-px",
        {
          relative: children,
        },
        className,
      )}
      {...props}
    >
      {children ? (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
          {children}
        </div>
      ) : null}
    </SeparatorPrimitive.Root>
  )
}

export { Separator }
