"use client"

import { cn } from "@/lib/utils"

import { signIn } from "next-auth/react"
import {
  PiDiscordLogo,
  PiDiscordLogoDuotone,
  PiGithubLogo,
  PiGithubLogoDuotone,
  PiGoogleLogo,
  PiGoogleLogoDuotone,
} from "react-icons/pi"
import { toast } from "sonner"

type ProviderType = "discord" | "github" | "google"

interface ProviderCardProps {
  provider: ProviderType
  connected: boolean
}

export function ProviderCard({ provider, connected }: ProviderCardProps) {
  const icons = {
    discord: {
      connected: <PiDiscordLogoDuotone className="h-6 w-6" />,
      disconnected: <PiDiscordLogo className="h-6 w-6" />,
    },
    github: {
      connected: <PiGithubLogoDuotone className="h-6 w-6" />,
      disconnected: <PiGithubLogo className="h-6 w-6" />,
    },
    google: {
      connected: <PiGoogleLogoDuotone className="h-6 w-6" />,
      disconnected: <PiGoogleLogo className="h-6 w-6" />,
    },
  }

  const providerNames = {
    discord: "Discord",
    github: "GitHub",
    google: "Google",
  }

  return (
    <div
      className="flex cursor-pointer items-center gap-2 rounded-full border bg-neutral-50 py-2 pl-4 pr-6 shadow transition-colors hover:bg-neutral-100 dark:bg-neutral-900 dark:hover:bg-neutral-800"
      onClick={async () => {
        if (connected) {
          toast.success("Already Connected", {
            description: `You're already connected to ${providerNames[provider]}.`,
          })
          return
        }
        await signIn(provider)
      }}
    >
      {connected ? icons[provider].connected : icons[provider].disconnected}
      <div className="flex flex-col items-center">
        <p className="font-semibold">{providerNames[provider]}</p>
        <p
          className={cn("text-xs text-neutral-400", {
            "text-emerald-600": connected,
          })}
        >
          {connected ? "Connected" : "Not connected"}
        </p>
      </div>
    </div>
  )
}

export function DiscordCard({ connected }: { connected: boolean }) {
  return <ProviderCard provider="discord" connected={connected} />
}

export function GithubCard({ connected }: { connected: boolean }) {
  return <ProviderCard provider="github" connected={connected} />
}

export function GoogleCard({ connected }: { connected: boolean }) {
  return <ProviderCard provider="google" connected={connected} />
}
