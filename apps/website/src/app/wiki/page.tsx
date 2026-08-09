import { Footer } from "@/components/footer"
import { Card } from "@/components/ui/card"
import { getWikiPages } from "@/lib/server/wiki"

import Link from "next/link"

export const metadata = {
  title: "easyshell - wiki",
  description: "Wiki for easyshell",
}

export default async function Page() {
  const pages = await getWikiPages()

  return (
    <div className="flex h-full flex-col items-center gap-8">
      <div
        className="w-full bg-gray-50 p-10 lg:p-10 dark:bg-emerald-950"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='4' height='4' viewBox='0 0 4 4'%3E%3Cpath fill='%239C92AC' fill-opacity='0.4' d='M1 3h1v1H1V3zm2-2h1v1H3V1z'%3E%3C/path%3E%3C/svg%3E")`,
        }}
      >
        <h1 className="font-clash-display text-center text-3xl font-bold lg:text-6xl dark:text-emerald-100">
          Wiki
        </h1>
      </div>
      <div className="flex w-2/3 flex-col gap-4">
        {pages.map((page) => (
          <WikiPageCard key={page.id} page={page} />
        ))}
      </div>
      <Footer className="mt-auto" />
    </div>
  )
}

function WikiPageCard({
  page,
}: {
  page: Awaited<ReturnType<typeof getWikiPages>>[number]
}) {
  if (page.type === "editorial") {
    return <WikiEditorialCard title={page.title} id={page.id} />
  }
  return null
}

async function WikiEditorialCard({ title, id }: { title: string; id: string }) {
  return (
    <Link href={`/wiki/${id}`} prefetch={true}>
      <Card className="flex w-full flex-col gap-4 border p-4 transition-colors hover:bg-neutral-100/60 dark:hover:bg-neutral-950/60">
        <div className="flex flex-col justify-center">
          <div className="font-clash-display text-4xl font-bold">{title}</div>
          <div className="font-clash-display flex justify-end text-neutral-500">
            <div>{"EDITORIAL"}</div>
          </div>
        </div>
      </Card>
    </Link>
  )
}
