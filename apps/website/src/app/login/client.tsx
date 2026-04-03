"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useEffect } from "react"
import { toast } from "sonner"

import { LoginForm } from "./_components/form"

function validCallbackUrl(url: string | null): boolean {
  return url == undefined || /^\/(?:[\w-]+\/?)*$/.test(url)
}

export function Client({ loggedIn }: { loggedIn: boolean }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  let callback = searchParams.get("callback")

  if (!validCallbackUrl(callback)) {
    callback = "/"
  }

  useEffect(() => {
    if (loggedIn) {
      toast("You are already logged in")
      if (validCallbackUrl(callback)) {
        router.push(callback ?? "/")
      }
      return
    }

    // Clean up the URL by stripping invalid/unnecessary params
    if (callback === "/") {
      router.replace("/login")
    } else if (callback != null) {
      router.replace(`/login?callback=${callback}`)
    }
  }, [router, loggedIn, callback])

  if (loggedIn) return null

  return <LoginForm callback={callback ?? "/"} />
}
