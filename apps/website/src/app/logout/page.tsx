import { redirect } from "next/navigation"

import { auth } from "@/lib/server/auth"

import { LogoutForm } from "./_components/form"

export default async function Page() {
  const loggedOut = (await auth())?.user === undefined
  if (loggedOut) {
    redirect("/")
  }

  return (
    <div className="flex h-full w-full items-center justify-center">
      <LogoutForm />
    </div>
  )
}
