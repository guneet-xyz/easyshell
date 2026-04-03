import { cn } from "@/lib/utils"

export function TextBackground({
  text,
  children,
  className,
}: {
  text: string
  children?: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden bg-neutral-100 dark:bg-stone-900",
        className,
      )}
    >
      <div className="text-md absolute top-0 left-0 flex flex-col font-clash-display font-bold text-nowrap text-neutral-300 *:flex *:flex-nowrap *:gap-4 dark:text-neutral-700">
        <div className="animate-text-loop-left">
          {Array.from({ length: 20 }).map((_, i) => (
            <p key={i}>{text}</p>
          ))}
        </div>
        <div className="animate-text-loop-right">
          {Array.from({ length: 20 }).map((_, i) => (
            <p key={i}>{text}</p>
          ))}
        </div>
        <div className="animate-text-loop-left">
          {Array.from({ length: 20 }).map((_, i) => (
            <p key={i}>{text}</p>
          ))}
        </div>
        <div className="animate-text-loop-right">
          {Array.from({ length: 20 }).map((_, i) => (
            <p key={i}>{text}</p>
          ))}
        </div>
      </div>

      {children}
    </div>
  )
}
