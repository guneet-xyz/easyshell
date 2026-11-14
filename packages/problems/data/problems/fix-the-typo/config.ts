import { createHash } from "crypto"
import { cp, readFile, writeFile } from "fs/promises"

import type { ProblemConfig } from "@easyshell/problems/schema"
import { testcaseDir } from "@easyshell/utils/build"

const SLUG = "fix-the-typo"
const REVISION_SALT = "jog-is-not-a-job:"

type Post = { id: number; author: string; content: string; revision: number }

async function testcaseConfig({
  id,
  isPublic,
  posts,
}: {
  id: number
  isPublic: boolean
  posts: Array<Post>
}): Promise<ProblemConfig["testcases"][number]> {
  const dir = testcaseDir(SLUG, id)
  const token = (await readFile(`${dir}/token.txt`, "utf-8")).trim()
  const fix = JSON.parse(await readFile(`${dir}/fix.json`, "utf-8")) as {
    id: number
    content: string
  }

  const post = posts.find((post) => post.id === fix.id)
  if (!post) throw new Error(`${SLUG} testcase ${id}: post ${fix.id} missing`)

  // The daemon's revision after one PUT: "<edits>-<sha256 of salt+content>".
  // The salt stays on the server, so the revision can't be computed locally
  // from fix.json without sending the PUT.
  const hash = createHash("sha256")
    .update(REVISION_SALT + fix.content)
    .digest("hex")
  const revision = `${post.revision + 1}-${hash.slice(0, 8)}`

  return {
    id: id,
    public: isPublic,
    expected_stdout: revision,
    daemonSetup: async ({ image_dir, problem_dir }) => {
      await cp(`${problem_dir}/daemon`, `${image_dir}/daemon`, {
        recursive: true,
      })
      await writeFile(
        `${image_dir}/daemon/data.json`,
        JSON.stringify({ token, salt: REVISION_SALT, posts }),
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
  id: 79,
  slug: SLUG,
  title: "Fix the Typo",
  description: `You posted a typo. Your boss follows you. Fix it before he wakes up. ✏️`,
  difficulty: "medium",
  tags: ["curl", "jq"],
  testcases: [
    await testcaseConfig({
      id: 1,
      isPublic: true,
      posts: [
        {
          id: 1336,
          author: "Melon Usk",
          content: "Twitter Clone is mine now. Kidding. Unless?",
          revision: 7,
        },
        {
          id: 1337,
          author: "easyshell-user",
          content: "I love my new jog!",
          revision: 1,
        },
      ],
    }),
    await testcaseConfig({
      id: 2,
      isPublic: true,
      posts: [
        {
          id: 4095,
          author: "Grandma",
          content: "So proud of my grandchild!!! Wizard!!!",
          revision: 1,
        },
        {
          id: 4096,
          author: "easyshell-user",
          content:
            "Big news: I'm the new Senior Shell Lizard at Twitter Clone Inc.",
          revision: 3,
        },
      ],
    }),
    await testcaseConfig({
      id: 3,
      isPublic: false,
      posts: [
        {
          id: 2718,
          author: "easyshell-user",
          content: 'Dear boss,\nI wrote "jog". I have always written "jog".',
          revision: 2,
        },
        {
          id: 3141,
          author: "The Boss",
          content: "Who wrote jog?",
          revision: 1,
        },
      ],
    }),
    await testcaseConfig({
      id: 4,
      isPublic: false,
      posts: [
        {
          id: 9000,
          author: "The Intern",
          content: "It's over 9000!",
          revision: 1,
        },
        {
          id: 9001,
          author: "easyshell-user",
          content: "New jog, who dis?",
          revision: 5,
        },
      ],
    }),
  ],
  tests: [
    {
      testcase: "all",
      pass: true,
      input: `jq -c '{content}' fix.json | curl -s -X PUT -H "Authorization: Bearer $(cat token.txt)" -H 'Content-Type: application/json' -d @- "http://localhost:4000/posts/$(jq .id fix.json)" | jq -r .revision`,
    },
    {
      testcase: "all",
      pass: true,
      input: `id=$(jq -r .id fix.json)
jq '{content: .content}' fix.json > body.json
curl -s --request PUT --header "Authorization: Bearer $(cat token.txt)" --json @body.json localhost:4000/posts/$id | jq -j .revision`,
    },
    {
      testcase: "all",
      pass: false,
      input: `jq -c '{content}' fix.json | curl -s -X POST -H "Authorization: Bearer $(cat token.txt)" -d @- "http://localhost:4000/posts/$(jq .id fix.json)" | jq -r .revision`,
    },
    {
      testcase: "all",
      pass: false,
      input: `jq -c '{content}' fix.json | curl -s -X PUT -d @- "http://localhost:4000/posts/$(jq .id fix.json)" | jq -r .revision`,
    },
    {
      testcase: "all",
      pass: false,
      input: `edits=$(curl -s "http://localhost:4000/posts/$(jq .id fix.json)" | jq -r .revision | cut -d - -f 1)
echo "$((edits + 1))-$(jq -j .content fix.json | sha256sum | cut -c 1-8)"`,
    },
    {
      testcase: [3, 4],
      pass: false,
      input: `curl -s -X PUT -H "Authorization: Bearer $(cat token.txt)" -d "{\\"content\\": \\"$(jq -r .content fix.json)\\"}" "http://localhost:4000/posts/$(jq .id fix.json)" | jq -r .revision`,
    },
  ],
}

export default config
