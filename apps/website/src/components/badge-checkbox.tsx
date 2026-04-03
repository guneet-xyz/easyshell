import { IoMdCheckmark } from "react-icons/io"
import { RxCross2 } from "react-icons/rx"

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

export function BadgeCheckbox({
  children,
  value,
  onValueChange,
  className,
}: {
  children: React.ReactNode
  value: boolean
  onValueChange: (value: boolean) => void
  className?: string
}) {
  return (
    <Badge
      className={cn(
        "flex cursor-pointer items-center justify-between gap-1 rounded-full dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-900",
        className,
      )}
      onClick={() => {
        onValueChange(!value)
      }}
    >
      <span className="grow text-center">{children}</span>
      {value ? <IoMdCheckmark /> : <RxCross2 />}
    </Badge>
  )
}
