import { Metadata } from "next"

import { Card, CardContent, CardHeader } from "@/components/ui/card"
import {
  listRunners,
  type listRunners as _listRunnersType,
} from "@/lib/server/actions/admin-runners"
import { requireAdmin } from "@/lib/server/admin"

import { CreateRunnerForm } from "./_components/CreateRunnerForm"
import { Forbidden } from "./_components/Forbidden"
import { RunnersTable } from "./_components/RunnersTable"

export const metadata: Metadata = {
  title: "easyshell - admin runners",
}

type RunnersList = Awaited<ReturnType<typeof _listRunnersType>>

export default async function Page() {
  try {
    await requireAdmin("/admin/runners")
  } catch (err) {
    if (err instanceof Response && err.status === 403) {
      return <Forbidden />
    }
    throw err
  }

  const data: RunnersList = await listRunners()

  return (
    <div className="min-h-screen p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Runner management</h1>
          <p className="text-sm text-gray-500">
            Create, rotate, and revoke runner credentials.
          </p>
        </div>

        <Card>
          <CardHeader>
            <h2 className="text-xl font-bold">Runners</h2>
            <p className="text-sm text-gray-500">
              Rotating or revoking takes effect immediately; the row is kept for
              audit history.
            </p>
          </CardHeader>
          <CardContent>
            <RunnersTable runners={data.runners} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-xl font-bold">Create runner</h2>
            <p className="text-sm text-gray-500">
              The generated token is shown ONCE. Copy it before leaving the
              page.
            </p>
          </CardHeader>
          <CardContent>
            <CreateRunnerForm />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
