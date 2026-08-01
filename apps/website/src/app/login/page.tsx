import { getAuthSession } from "@/lib/server/auth"

import { Client } from "./client"

export default async function Page() {
  const loggedIn = (await getAuthSession())?.user !== undefined

  return (
    <div className="flex h-full w-full items-center justify-center">
      <Client loggedIn={loggedIn} />
    </div>
  )
}
