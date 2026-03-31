"use client"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"

import { signIn } from "next-auth/react"
import { useState } from "react"
import {
  PiDiscordLogo,
  PiDiscordLogoDuotone,
  PiEnvelope,
  PiEnvelopeDuotone,
  PiGithubLogo,
  PiGithubLogoDuotone,
  PiGoogleLogo,
  PiGoogleLogoDuotone,
} from "react-icons/pi"
import { toast } from "sonner"
import { z } from "zod"

export function LoginForm({ callback }: { callback: string }) {
  const [email, setEmail] = useState("")
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-xl border p-8 shadow-xl">
      <div>
        <h1 className="text-center text-2xl font-semibold">easyshell.sh</h1>
        <h2 className="text-center font-semibold text-gray-500">Login</h2>
      </div>
      <div className="w-full px-8 py-4">
        <Card className="flex w-full flex-col gap-4 p-4">
          <Button
            className="group flex items-center gap-2 hover:bg-gray-200 dark:hover:bg-neutral-200 dark:hover:text-black"
            variant="secondary"
            onClick={async () => {
              await signIn("google", { callbackUrl: callback })
            }}
          >
            <div className="relative h-8 w-6">
              <PiGoogleLogo className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-3xl transition-opacity group-hover:opacity-0" />
              <PiGoogleLogoDuotone className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-3xl opacity-0 transition-opacity group-hover:opacity-100" />
            </div>
            <p className="grow text-center">Login with Google</p>
          </Button>
          <Button
            className="group flex items-center gap-2 hover:bg-gray-200 dark:hover:bg-neutral-200 dark:hover:text-black"
            variant="secondary"
            onClick={async () => {
              await signIn("github", { callbackUrl: callback })
            }}
          >
            <div className="relative h-8 w-6">
              <PiGithubLogo className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-3xl transition-opacity group-hover:opacity-0" />
              <PiGithubLogoDuotone className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-3xl opacity-0 transition-opacity group-hover:opacity-100" />
            </div>
            <p className="grow text-center">Login with GitHub</p>
          </Button>
          <Button
            className="group flex items-center gap-4 hover:bg-gray-200 dark:hover:bg-neutral-200 dark:hover:text-black"
            variant="secondary"
            onClick={async () => {
              await signIn("discord", { callbackUrl: callback })
            }}
          >
            <div className="relative h-8 w-6">
              <PiDiscordLogo className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-3xl transition-opacity group-hover:opacity-0" />
              <PiDiscordLogoDuotone className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-3xl opacity-0 transition-opacity group-hover:opacity-100" />
            </div>
            <p className="grow text-center">Login with Discord</p>
          </Button>
        </Card>
      </div>
      <Separator>
        <p className="bg-white p-2 text-xs font-semibold text-neutral-400 dark:bg-neutral-900 dark:text-neutral-600">
          OR
        </p>
      </Separator>
      <div className="w-full px-8 py-4">
        <Card className="flex w-full flex-col gap-4 px-6 py-4">
          <div className="flex flex-col gap-2">
            <div className="text-sm font-semibold">Email</div>
            <Input
              placeholder="Enter your email address"
              className="w-full"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value)
              }}
            />
          </div>
          <Button
            className="group flex items-center gap-2 hover:bg-gray-200 dark:hover:bg-neutral-200 dark:hover:text-black"
            variant="secondary"
            onClick={async () => {
              const parsedEmail = z.string().email().safeParse(email)
              if (!parsedEmail.success) {
                toast.error("Please enter a valid email address.")
                return
              }
              await signIn("resend", {
                email: parsedEmail.data,
                callbackUrl: callback,
              })
            }}
          >
            <div className="relative h-8 w-6">
              <PiEnvelope className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-3xl transition-opacity group-hover:opacity-0" />
              <PiEnvelopeDuotone className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-3xl opacity-0 transition-opacity group-hover:opacity-100" />
            </div>
            <p className="grow text-center">Login with Email</p>
          </Button>
        </Card>
      </div>
      <div
        className={cn("text-sm text-neutral-400 dark:text-neutral-600", {
          hidden: callback === "/",
        })}
      >
        <span>You will be redirected to </span>
        <span className="rounded-md border bg-neutral-200 px-2 text-neutral-600 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-400">
          {callback}
        </span>
        <span> after logging in.</span>
      </div>
    </div>
  )
}
