import { Markdown } from "@/components/markdown"
import { getProblemBody } from "@/lib/server/problems"

export async function ProblemBody({ id }: { id: string }) {
  const text = await getProblemBody(id)
  return (
    <div className="mx-4">
      <Markdown source={text} />
    </div>
  )
}
