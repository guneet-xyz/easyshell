import { BackgroundHeroTexture } from "@/components/backgrounds/hero-texture"
import { Markdown } from "@/components/markdown"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { getProblemHintBody, getProblemHintCount } from "@/lib/server/problems"

export function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-4 mt-6 border-t">
      <h2 className="mt-6 mb-2 text-xl font-bold">Hints</h2>
      {children}
    </div>
  )
}

export async function ProblemHints({ slug }: { slug: string }) {
  const hintCount = await getProblemHintCount(slug)
  if (hintCount === 0)
    return (
      <Wrapper>
        <BackgroundHeroTexture className="heropattern-texture-neutral-200 rounded-md border border-neutral-300 bg-neutral-50 py-4 text-center text-neutral-400">
          No hints for this one. Good luck!
        </BackgroundHeroTexture>
      </Wrapper>
    )
  const hints = await Promise.all(
    Array.from({ length: hintCount }).map(async (_, hint) => {
      return {
        hint: hint + 1,
        node: <Markdown source={await getProblemHintBody(slug, hint + 1)} />,
      }
    }),
  )

  hints.sort((a, b) => a.hint - b.hint)

  return (
    <Wrapper>
      <Accordion type="single" collapsible className="space-y-4">
        {hints.map(({ node }, i) => (
          <AccordionItem
            value={`${i + 1}`}
            key={i + 1}
            className="border-top-0 rounded-lg border bg-neutral-100 shadow-sm dark:bg-neutral-900"
          >
            <AccordionTrigger className="text-md rounded-lg border bg-white px-4 py-2 font-semibold shadow-sm hover:bg-neutral-50 dark:bg-black">{`Hint #${i + 1}`}</AccordionTrigger>
            <AccordionContent className="px-4 py-2">{node}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </Wrapper>
  )
}
