"use client"

import { Button } from "@/components/ui/button"

import Link from "next/link"
import { usePathname } from "next/navigation"

export function LoginToProceed() {
  const pathname = usePathname()
  return (
    <div className="my-auto flex h-full w-full flex-grow items-center justify-center">
      <div className="flex max-w-80 flex-col items-center justify-center rounded-xl border p-4 shadow">
        <div className="mb-4 text-center text-neutral-600 dark:text-neutral-400">
          Interacting with this part of the website requires you to log in.
        </div>
        <Link
          href={`/login?callback=${pathname}`}
          className="w-full"
          prefetch={true}
        >
          <Button className="w-full px-8">Login to Proceed</Button>
        </Link>
      </div>
    </div>
  )
}
