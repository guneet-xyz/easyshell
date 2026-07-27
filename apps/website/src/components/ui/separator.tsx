"use client"

import { cn } from "@/lib/utils"

import * as SeparatorPrimitive from "@radix-ui/react-separator"
import * as React from "react"

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
        "bg-border shrink-0 data-[orientation=horizontal]:h-px data-[orientation=vertical]:h-full data-[orientation=horizontal]:w-full data-[orientation=vertical]:w-px",
        {
          relative: children,
        },
        className,
      )}
      {...props}
    >
      {children ? (
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          {children}
        </div>
      ) : null}
    </SeparatorPrimitive.Root>
  )
}

export { Separator }
