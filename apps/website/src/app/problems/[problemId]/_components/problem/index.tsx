import { ProblemAbout } from "./about"
import { ProblemBody } from "./body"
import { ProblemEditorial } from "./editorial"
import { ProblemHeading } from "./heading"
import { ProblemHints } from "./hints"
import { ProblemRelatedWiki } from "./wiki"

export function Problem({ id }: { id: string }) {
  return (
    <div className="h-[calc(100vh-80px)] py-2 dark:bg-neutral-900">
      <ProblemHeading id={id} />
      <div className="h-[calc(100vh-220px)] overflow-y-scroll">
        <ProblemEditorial id={id} />
        <ProblemBody id={id} />
        <ProblemHints id={id} />
        <ProblemAbout id={id} />
        <ProblemRelatedWiki id={id} />
      </div>
    </div>
  )
}
