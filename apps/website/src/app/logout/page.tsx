import { getAuthSession } from "@/lib/server/auth"

import { LogoutForm } from "./_components/form"

import { redirect } from "next/navigation"

export default async function Page() {
  const loggedOut = (await getAuthSession())?.user === undefined
  if (loggedOut) {
    redirect("/")
  }

  return (
    <div className="flex h-full w-full items-center justify-center">
      <LogoutForm />
    </div>
  )
}
