"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { authClient } from "@/lib/auth-client"

export function LogoutForm() {
  const router = useRouter()
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
            await authClient.signOut()
            router.push("/")
            router.refresh()
          }}
        >
          Log Out
        </Button>
      </div>
    </Card>
  )
}
