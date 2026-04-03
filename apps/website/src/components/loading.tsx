import { PiTerminalWindow } from "react-icons/pi"

export function Loading() {
  return (
    <div className="relative flex h-full items-center justify-center">
      <div className="absolute top-1/2 left-1/2 -z-10 -translate-x-1/2 -translate-y-1/2">
        <div className="relative size-40">
          <PiTerminalWindow className="absolute top-1/2 left-1/2 -z-8 size-40 -translate-x-1/2 -translate-y-1/2 text-neutral-300 dark:text-neutral-700" />
          <div className="absolute top-1/2 left-[15%] -z-9 h-[60%] w-1/2 -translate-y-1/2 animate-progress bg-neutral-100 dark:bg-neutral-800" />
        </div>
      </div>
      <div className="font-clash-display text-4xl font-bold text-neutral-700 dark:text-neutral-300">
        <span>Loading problem</span>
      </div>
    </div>
  )
}
