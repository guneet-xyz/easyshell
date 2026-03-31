"use client"

import { ResizableHandle, ResizablePanel } from "@/components/ui/resizable"

import { useRef, useState } from "react"
import { PiCaretDoubleRightDuotone, PiCaretLeftFill } from "react-icons/pi"
import type { ImperativePanelHandle } from "react-resizable-panels"

export function CollapsibleProblemPanel({
  children,
}: {
  children: React.ReactNode
}) {
  const [collapsed, setCollapsed] = useState(false)
  const panelRef = useRef<ImperativePanelHandle>(null)

  return (
    <>
      <ResizablePanel
        ref={panelRef}
        collapsible
        collapsedSize={0}
        minSize={16}
        onCollapse={() => {
          setCollapsed(true)
        }}
        onExpand={() => {
          setCollapsed(false)
        }}
        className=""
      >
        {children}
      </ResizablePanel>
      {collapsed ? (
        <div
          className="relative flex h-full w-10 cursor-pointer flex-col items-center justify-between rounded-r-lg border-r-4 border-neutral-600 bg-neutral-200 py-6 text-neutral-600 hover:bg-neutral-300 dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800/50"
          onClick={() => {
            panelRef.current?.expand()
          }}
        >
          <PiCaretDoubleRightDuotone />
          <PiCaretDoubleRightDuotone />
          <p className="font-clash-display absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rotate-90 text-nowrap font-semibold">
            <p>View Problem</p>
          </p>
        </div>
      ) : (
        <ResizableHandle
          withHandle
          handle={
            <div
              className="z-20 flex cursor-pointer items-center justify-center rounded-md bg-neutral-200 px-1 py-4 hover:bg-neutral-300 dark:bg-neutral-800 dark:hover:bg-neutral-700"
              onClick={() => {
                panelRef.current?.collapse()
              }}
            >
              <PiCaretLeftFill className="text-neutral-600 dark:text-neutral-400" />
            </div>
          }
        />
      )}
    </>
  )
}
