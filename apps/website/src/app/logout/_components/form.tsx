"use client"

import { signOut } from "next-auth/react"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"

export function LogoutForm() {
  return (
    <Card className="flex w-fit flex-col rounded-xl border px-8 py-4">
      <h2 className="text-lg font-semibold">{`You're about to log out`}</h2>
      <h3 className="text-sm text-neutral-400">{`Are you sure you want to log out?`}</h3>
      <div className="mt-4 flex gap-2 *:*:w-full *:grow">
        <Link href="/" prefetch={true}>
          <Button variant={"secondary"}>Cancel</Button>
        </Link>
        <Button
          variant={"destructive"}
          onClick={async () => {
            await signOut()
          }}
        >
          Log Out
        </Button>
      </div>
    </Card>
  )
}
