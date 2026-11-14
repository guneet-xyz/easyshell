import { cp, readFile, writeFile } from "fs/promises"

import type { ProblemConfig } from "@easyshell/problems/schema"
import { testcaseDir } from "@easyshell/utils/build"

const SLUG = "search-party"

type Post = { author: string; content: string }

/** Number of posts the daemon finds for a query (see daemon/main.go). */
function count(posts: Array<Post>, query: string) {
  if (query === "") return undefined
  return posts.filter((post) => post.content.includes(query)).length
}

async function testcaseConfig({
  id,
  isPublic,
  posts,
}: {
  id: number
  isPublic: boolean
  posts: Array<Post>
}): Promise<ProblemConfig["testcases"][number]> {
  const query = (
    await readFile(`${testcaseDir(SLUG, id)}/query.txt`, "utf-8")
  ).replace(/\n$/, "")
  const expected = count(posts, query)

  // What the server sees when the query is not encoded properly: a raw "&"
  // starts a new parameter, a raw "#" starts the fragment, and a raw "+" is a
  // space. None of these may accidentally give the right count.
  const wrongQueries = [
    query.split("&")[0]!,
    query.split("#")[0]!,
    query.replaceAll("+", " "),
  ].filter((wrong) => wrong !== query)
  for (const wrong of wrongQueries) {
    if (count(posts, wrong) === expected) {
      throw new Error(
        `${SLUG} testcase ${id}: the mangled query ${JSON.stringify(wrong)} gives the same count as the real one`,
      )
    }
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
        JSON.stringify({
          posts: posts.map((post, index) => ({ id: index + 1, ...post })),
        }),
      )

      return `
RUN apk add go
COPY daemon /src/daemon
RUN go build -C /src/daemon -o /daemon && go clean -cache
`
    },
  }
}

const config: ProblemConfig = {
  id: 76,
  slug: SLUG,
  title: "Search Party",
  description: `Search for posts full of spaces, ampersands and other things URLs hate. 🔎`,
  difficulty: "medium",
  tags: ["curl", "jq"],
  testcases: [
    await testcaseConfig({
      id: 1,
      isPublic: true,
      posts: [
        { author: "Kevin", content: "Pineapple on pizza is not a crime." },
        { author: "Grandma", content: "Kevin, pineapple on pizza is a crime." },
        { author: "Melon Usk", content: "Buying a pizza place. Maybe." },
        { author: "The Strokes", content: "Is this it? Is this the pizza?" },
        { author: "The Intern", content: "Pizza Friday is my favourite day." },
        { author: "Captain Shellbeard", content: "Arr, where be the rum?" },
      ],
    }),
    await testcaseConfig({
      id: 2,
      isPublic: true,
      posts: [
        { author: "The Strokes", content: "rock & roll will never die" },
        { author: "Grandma", content: "I danced to rock & roll in 1957." },
        { author: "Kevin", content: "This rock is my best friend now." },
        {
          author: "The Intern",
          content: "Found a cool rock in the parking lot",
        },
        {
          author: "Melon Usk",
          content: "Sending a rock to Mars. You're welcome.",
        },
        { author: "Captain Shellbeard", content: "Arr, the ship hit a rock." },
        { author: "The Strokes", content: "Rock and roll is a state of mind" },
      ],
    }),
    await testcaseConfig({
      id: 3,
      isPublic: false,
      posts: [
        { author: "The Intern", content: "C++ & C# = 100% #fun" },
        { author: "Kevin", content: "C++ & C# = 100% #fun, said nobody ever" },
        { author: "Grandma", content: "My C++ class starts on Monday!" },
        { author: "Melon Usk", content: "Rewriting Twitter in C++ tonight." },
        { author: "The Strokes", content: "C++ & C are both letters to me" },
        { author: "Captain Shellbeard", content: "I only speak C (the sea)." },
        { author: "You", content: "C++ & C# = 100% #pain" },
      ],
    }),
    await testcaseConfig({
      id: 4,
      isPublic: false,
      posts: [
        { author: "The Strokes", content: "🎸 solo 🔥 at the show tonight" },
        {
          author: "Grandma",
          content: "Kevin did a 🎸 solo 🔥 at Sunday lunch",
        },
        { author: "Kevin", content: "My 🎸 solo was robbed." },
        { author: "Melon Usk", content: "🔥 solo 🎸 (I invented guitars)" },
        {
          author: "The Intern",
          content: "Learning the 🎸 solo 🔥 from YouTube",
        },
        { author: "Captain Shellbeard", content: "🏴‍☠️ solo 🔥" },
      ],
    }),
  ],
  tests: [
    {
      testcase: "all",
      pass: true,
      input: `curl -sG --data-urlencode "q=$(cat query.txt)" http://localhost:4000/search | jq .count`,
    },
    {
      testcase: "all",
      pass: true,
      input: `q=$(jq -rR @uri query.txt); curl -s "http://localhost:4000/search?q=$q" | jq .count`,
    },
    {
      testcase: "all",
      pass: true,
      input: `curl -s "localhost:4000/search?q=$(head -n 1 query.txt | jq -sRr 'rtrimstr("\\n") | @uri')" | jq -r '.results | length'`,
    },
    {
      testcase: [2, 3, 4],
      pass: false,
      input: `curl -s "http://localhost:4000/search?q=$(cat query.txt)" | jq .count`,
    },
    {
      testcase: [2, 3],
      pass: false,
      input: `curl -s "http://localhost:4000/search?q=$(sed 's/ /%20/g' query.txt)" | jq .count`,
    },
  ],
}

export default config
