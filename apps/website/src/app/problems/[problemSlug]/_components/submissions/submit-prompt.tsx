"use client"

import {
  PromptSettings,
  usePromptSettingsContext,
} from "@/app/settings/_components/prompt-settings"
import { CommandKey, ReturnKey } from "@/components/keys"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { EasyTooltip } from "@/components/ui/tooltip"
import { clientOS } from "@/lib/client"
import { newSubmission } from "@/lib/server/actions/new-submission"
import { cn } from "@/lib/utils"

import { usePathname, useRouter } from "next/navigation"
import { usePostHog } from "posthog-js/react"
import { useState } from "react"
import { BsGearWideConnected } from "react-icons/bs"
import { PiCaretLeftFill } from "react-icons/pi"
import { toast } from "sonner"

export function SubmitPrompt({
  problemId,
  problemSlug,
}: {
  problemId: number
  problemSlug: string
}) {
  const pathname = usePathname()
  const router = useRouter()
  const posthog = usePostHog()

  const [input, setInput] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const os = clientOS()

  const [dialogOpen, setDialogOpen] = useState(false)

  async function handleSubmit() {
    setSubmitting(true)
    posthog.capture("submission", {
      problemSlug,
    })
    const resp = await newSubmission({
      problemId,
      input,
    })
    if (!resp) {
      toast.error("Failed to submit command", {
        description: "Unauthenticated",
      })
      setSubmitting(false)
      return
    }
    router.replace(
      `${pathname}?tab=submissions&submission=${resp.submissionId}`,
    )
    setSubmitting(false)
  }

  const { multiline } = usePromptSettingsContext()

  return (
    <div
      className={cn("flex gap-1", {
        "flex-col": multiline,
      })}
    >
      <div className="relative h-fit grow">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={submitting}
          className={cn(
            "h-10 min-h-10 resize-none self-center border-2 border-neutral-400 font-mono dark:border-neutral-600",
            {
              "h-20 resize-y": multiline,
            },
          )}
          onKeyDown={async (e) => {
            if (submitting) return
            if (e.key === "Enter") {
              if (
                (os === "windows" && e.ctrlKey) ||
                (os === "mac" && e.metaKey) ||
                (os === "linux" && e.ctrlKey)
              ) {
                await handleSubmit()
              } else if (multiline) {
                setInput((prev) => prev + "\n")
              } else {
                e.preventDefault()
              }
            }
          }}
        />
        {["windows", "linux", "mac"].includes(os) ? (
          <div
            className={cn(
              "absolute right-4 top-1/2 flex -translate-y-1/2 items-center gap-1 text-sm text-neutral-400",
              {
                hidden: multiline,
              },
            )}
          >
            <CommandKey />
            <ReturnKey />
          </div>
        ) : null}
      </div>
      <div className={cn("flex h-fit gap-1", { "w-full": multiline })}>
        <EasyTooltip
          tip={
            !multiline && ["windows", "linux", "mac"].includes(os) ? (
              <div className="flex items-center gap-1 text-sm text-neutral-400">
                <CommandKey />
                <ReturnKey />
              </div>
            ) : undefined
          }
        >
          <Button
            disabled={submitting}
            onClick={handleSubmit}
            className={cn(
              "flex items-center gap-4 dark:bg-neutral-300 dark:hover:bg-neutral-200",
              { grow: multiline },
            )}
          >
            <div>Submit</div>
            <div
              className={cn(
                "hidden items-center gap-1 text-sm text-neutral-400",
                {
                  flex: multiline,
                },
              )}
            >
              <CommandKey />
              <ReturnKey />
            </div>
          </Button>
        </EasyTooltip>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <EasyTooltip tip="Prompt Settings">
              <div
                className={cn(
                  "group flex h-10 w-4 cursor-pointer items-center justify-center rounded-md bg-neutral-200 text-neutral-500 transition-all hover:w-10 hover:bg-neutral-300 dark:bg-neutral-800 dark:hover:bg-neutral-700",
                  {
                    "w-10": dialogOpen || multiline,
                  },
                )}
                onClick={() => setDialogOpen(!dialogOpen)}
              >
                <PiCaretLeftFill
                  className={cn("group-hover:hidden", {
                    hidden: multiline || dialogOpen,
                  })}
                />
                <BsGearWideConnected
                  className={cn("hidden group-hover:block", {
                    block: multiline || dialogOpen,
                  })}
                />
              </div>
            </EasyTooltip>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Prompt Settings</DialogTitle>
              <DialogDescription className="text-gray-500">
                Configure the submission prompt.
              </DialogDescription>
            </DialogHeader>
            <PromptSettings />
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
