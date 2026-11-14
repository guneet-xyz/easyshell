import { cp, writeFile } from "fs/promises"

import type { ProblemConfig } from "@easyshell/problems/schema"

const SLUG = "page-turner"
const BAND = "The Strokes"

type Post = { id: number; author: string; content: string }
type Page = { posts: Array<Post>; next: number | null }

const SONGS = [
  "Last Nite",
  "Reptilia",
  "Someday",
  "Hard to Explain",
  "12:51",
  "Juicebox",
  "You Only Live Once",
  "The Adults Are Talking",
  "Is This It",
  "Under Cover of Darkness",
  "Ode to the Mets",
  "Bad Decisions",
]

const CHATTER: Record<string, Array<string>> = {
  "Melon Usk": [
    "Should I buy a record label?",
    "Guitars are just keyboards with strings.",
    "Pagination is woke.",
  ],
  Grandma: [
    "Who are these Strokes? Very polite boys.",
    "Cookies are ready!",
    "How do I go to page 2?",
  ],
  Kevin: ["I was into them first.", "Free rock, still available."],
  "The Intern": [
    "Is it normal for an API to have 40 pages?",
    "I renumbered the pages. You're welcome.",
  ],
  "Captain Shellbeard": ["Arr, play it louder!", "Sea shanties > indie rock."],
  "The Strokes Fan Club": ["Julian waved at me!!!", "Tour dates when???"],
  "the strokes": ["totally the real band, follow for free tickets"],
  "Not The Strokes": ["We're a cover band. Please stop suing us."],
}

/** Small deterministic PRNG (mulberry32), so the fixtures never change. */
function prng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Builds the pages. `chain` lists the page numbers reachable from page 1, in
 * order; `decoys` are pages that exist but aren't linked from anywhere.
 */
function makePages({
  seed,
  chain,
  decoys = [],
  lastPageSize,
  authors,
}: {
  seed: number
  chain: Array<number>
  decoys?: Array<number>
  lastPageSize: number
  authors: Array<string>
}) {
  const random = prng(seed)
  const pick = <T>(items: Array<T>) =>
    items[Math.floor(random() * items.length)]!
  let nextId = 1000 + seed * 10

  const pages: Record<string, Page> = {}
  const numbers = [...chain, ...decoys].toSorted((a, b) => a - b)
  for (const number of numbers) {
    const index = chain.indexOf(number)
    const size = number === chain.at(-1) ? lastPageSize : 10
    const posts: Array<Post> = []
    for (let i = 0; i < size; i++) {
      const author = pick(authors)
      const content =
        author === BAND
          ? `Now playing: "${pick(SONGS)}" 🎸`
          : pick(CHATTER[author]!)
      posts.push({ id: nextId++, author, content })
    }
    pages[number] = {
      posts,
      next: index === -1 ? null : (chain[index + 1] ?? null),
    }
  }
  return pages
}

function countBand(pages: Record<string, Page>, numbers: Array<number>) {
  return numbers
    .map((number) => pages[number]!.posts)
    .flat()
    .filter((post) => post.author === BAND).length
}

async function testcaseConfig({
  id,
  isPublic,
  pages,
  chain,
}: {
  id: number
  isPublic: boolean
  pages: Record<string, Page>
  chain: Array<number>
}): Promise<ProblemConfig["testcases"][number]> {
  const expected = countBand(pages, chain)

  // Reading only page 1, or counting pages up until one is missing, must not
  // give the right answer by accident when they read the wrong pages.
  let consecutive = 1
  while (pages[consecutive + 1]) consecutive++
  const countingUp = Array.from({ length: consecutive }, (_, i) => i + 1)
  const shortcuts = [[1], countingUp].filter(
    (numbers) => numbers.join() !== chain.join(),
  )
  if (shortcuts.some((numbers) => countBand(pages, numbers) === expected)) {
    throw new Error(`${SLUG} testcase ${id}: a shortcut gives the answer`)
  }

  return {
    id: id,
    public: isPublic,
    expected_stdout: `${expected}`,
    daemonSetup: async ({ image_dir, problem_dir }) => {
      await cp(`${problem_dir}/daemon`, `${image_dir}/daemon`, {
        recursive: true,
      })
      await writeFile(
        `${image_dir}/daemon/data.json`,
        JSON.stringify({ pages }),
      )

      return `
RUN apk add go
COPY daemon /src/daemon
RUN go build -C /src/daemon -o /daemon && go clean -cache
`
    },
  }
}

const COMMON_AUTHORS = [
  BAND,
  BAND,
  "Melon Usk",
  "Grandma",
  "Kevin",
  "The Intern",
  "Captain Shellbeard",
]
const LOOKALIKE_AUTHORS = [
  ...COMMON_AUTHORS,
  BAND,
  "The Strokes Fan Club",
  "the strokes",
  "Not The Strokes",
]

const testcases: Array<{
  id: number
  isPublic: boolean
  chain: Array<number>
  decoys?: Array<number>
  lastPageSize: number
  authors: Array<string>
}> = [
  {
    id: 1,
    isPublic: true,
    chain: [1, 2],
    lastPageSize: 7,
    authors: COMMON_AUTHORS,
  },
  {
    id: 2,
    isPublic: true,
    chain: [1, 2, 3, 4, 5],
    lastPageSize: 4,
    authors: COMMON_AUTHORS,
  },
  {
    id: 3,
    isPublic: false,
    chain: [1],
    lastPageSize: 9,
    authors: LOOKALIKE_AUTHORS,
  },
  {
    id: 4,
    isPublic: false,
    chain: [1, 3, 4, 8],
    decoys: [2, 5],
    lastPageSize: 5,
    authors: LOOKALIKE_AUTHORS,
  },
]

const config: ProblemConfig = {
  id: 81,
  slug: SLUG,
  title: "Page Turner",
  description: `The API only hands out 10 posts at a time, and nobody's clicking "next" 40 times. 📖`,
  difficulty: "medium",
  tags: ["curl", "jq", "while"],
  testcases: await Promise.all(
    testcases.map(({ id, isPublic, chain, decoys, lastPageSize, authors }) =>
      testcaseConfig({
        id,
        isPublic,
        chain,
        pages: makePages({ seed: id, chain, decoys, lastPageSize, authors }),
      }),
    ),
  ),
  tests: [
    {
      testcase: "all",
      pass: true,
      input: `p=1
while [ "$p" != null ]; do
  r=$(curl -s "http://localhost:4000/posts?page=$p")
  echo "$r" | jq '.posts[] | select(.author == "The Strokes") | 1'
  p=$(echo "$r" | jq .next)
done | wc -l`,
    },
    {
      testcase: "all",
      pass: true,
      input: `page=1
: > all.json
until [ "$page" = null ]; do
  curl -s "localhost:4000/posts?page=$page" > page.json
  jq -c '.posts[]' page.json >> all.json
  page=$(jq -r '.next // "null"' page.json)
done
jq -s 'map(select(.author == "The Strokes")) | length' all.json`,
    },
    {
      testcase: [1, 2, 4],
      pass: false,
      input: `curl -s "http://localhost:4000/posts?page=1" | jq '[.posts[] | select(.author == "The Strokes")] | length'`,
    },
    {
      testcase: [4],
      pass: false,
      input: `p=1
while r=$(curl -sf "http://localhost:4000/posts?page=$p"); do
  echo "$r" | jq '.posts[] | select(.author == "The Strokes") | 1'
  p=$((p + 1))
done | wc -l`,
    },
    {
      testcase: [3, 4],
      pass: false,
      input: `p=1
while [ "$p" != null ]; do
  r=$(curl -s "http://localhost:4000/posts?page=$p")
  echo "$r" | jq '.posts[] | select(.author | test("strokes"; "i")) | 1'
  p=$(echo "$r" | jq .next)
done | wc -l`,
    },
  ],
}

export default config
