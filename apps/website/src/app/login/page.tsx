import { auth, getLoginMethods } from "@/lib/server/auth"

import { Client } from "./client"

export default async function Page() {
  const loggedIn = (await auth())?.user !== undefined

  return (
    <div className="flex h-full w-full items-center justify-center">
      <Client loggedIn={loggedIn} methods={getLoginMethods()} />
    </div>
  )
}
