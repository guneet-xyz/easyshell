import { cp, writeFile } from "fs/promises"

import type { ProblemConfig } from "@easyshell/problems/schema"

const SLUG = "delete-the-evidence"

type Post = { author: string; content: string }

async function testcaseConfig({
  id,
  isPublic,
  firstId,
  posts,
  certificate,
}: {
  id: number
  isPublic: boolean
  firstId: number
  posts: Array<Post>
  certificate: string
}): Promise<ProblemConfig["testcases"][number]> {
  return {
    id: id,
    public: isPublic,
    expected_stdout: certificate,
    daemonSetup: async ({ image_dir, problem_dir }) => {
      await cp(`${problem_dir}/daemon`, `${image_dir}/daemon`, {
        recursive: true,
      })
      await writeFile(
        `${image_dir}/daemon/data.json`,
        JSON.stringify({
          posts: posts.map((post, index) => ({
            id: firstId + index * 7,
            ...post,
          })),
          certificate,
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
  id: 80,
  slug: SLUG,
  title: "Delete the Evidence",
  description: `Melon Usk posted something regrettable. Again. Make it disappear before Legal wakes up. 🗑️`,
  difficulty: "medium",
  tags: ["curl", "jq", "xargs"],
  testcases: [
    await testcaseConfig({
      id: 1,
      isPublic: true,
      firstId: 101,
      certificate: "CASE-4471-CLOSED",
      posts: [
        { author: "Grandma", content: "Good morning everyone! Cookies at 3." },
        {
          author: "Melon Usk",
          content: "Just bought the moon. Renaming it to X.",
        },
        { author: "The Strokes", content: "Is this it?" },
        {
          author: "Melon Usk",
          content: "Legal can't stop me if I post at 3 a.m.",
        },
        { author: "Kevin", content: "Does anyone want a rock? Free rock." },
      ],
    }),
    await testcaseConfig({
      id: 2,
      isPublic: true,
      firstId: 200,
      certificate: "CASE-8812-CLOSED",
      posts: [
        { author: "Melon Usk", content: "Hot take: gravity is optional." },
        { author: "Melon Usk", content: "Hotter take: so is sleep." },
        {
          author: "Captain Shellbeard",
          content: "Arr, who keeps postin' at 3 a.m.?",
        },
        { author: "Melon Usk", content: "Buying Captain Shellbeard's ship." },
        { author: "The Intern", content: "Is it normal for Legal to cry?" },
        { author: "Grandma", content: "Melon, dear, go to bed." },
        { author: "Melon Usk", content: "No." },
        { author: "The Strokes", content: "Last nite, she said..." },
      ],
    }),
    await testcaseConfig({
      id: 3,
      isPublic: false,
      firstId: 300,
      certificate: "CASE-3090-CLOSED",
      posts: [
        { author: "Melon Usk Fan Club", content: "Melon is a genius!!!" },
        { author: "Melon Usk", content: "I am a genius." },
        { author: "Not Melon Usk", content: "I am definitely not Melon Usk." },
        { author: "melon usk", content: "parody account, pls don't sue" },
        { author: "Grandma", content: "Has anyone seen Melon Usk's mother?" },
        {
          author: "Melon Usk",
          content: "Firing everyone whose name isn't Melon.",
        },
        { author: "Melon", content: "Just Melon. Like Cher." },
        { author: "The Intern", content: "Melon Usk fired me. Again." },
      ],
    }),
    await testcaseConfig({
      id: 4,
      isPublic: false,
      firstId: 400,
      certificate: "CASE-5127-CLOSED",
      posts: [
        { author: "Melon Usk Fan Club", content: "We miss Melon's posts!" },
        { author: "Grandma", content: "Finally, some peace and quiet." },
        { author: "Kevin", content: "Melon Usk blocked me. Best day ever." },
        { author: "The Strokes", content: "Reptilia, live tonight." },
      ],
    }),
  ],
  tests: [
    {
      testcase: "all",
      pass: true,
      input: `curl -s http://localhost:4000/posts | jq '.[] | select(.author == "Melon Usk") | .id' | xargs -I{} curl -s -X DELETE http://localhost:4000/posts/{} > /dev/null
curl -s http://localhost:4000/legal/clearance | jq -r .certificate`,
    },
    {
      testcase: "all",
      pass: true,
      input: `for id in $(curl -s localhost:4000/posts | jq -r 'map(select(.author == "Melon Usk")) | .[].id'); do
  curl -s --request DELETE "localhost:4000/posts/$id" > /dev/null
done
curl -s localhost:4000/legal/clearance | jq -j .certificate`,
    },
    {
      testcase: [3, 4],
      pass: false,
      input: `curl -s http://localhost:4000/posts | jq '.[] | select(.author | contains("Melon")) | .id' | xargs -I{} curl -s -X DELETE http://localhost:4000/posts/{} > /dev/null
curl -s http://localhost:4000/legal/clearance | jq -r .certificate`,
    },
    {
      testcase: [3],
      pass: false,
      input: `curl -s http://localhost:4000/posts | jq '.[] | select(.author | ascii_downcase == "melon usk") | .id' | xargs -I{} curl -s -X DELETE http://localhost:4000/posts/{} > /dev/null
curl -s http://localhost:4000/legal/clearance | jq -r .certificate`,
    },
    {
      testcase: [1, 2, 3],
      pass: false,
      input: `curl -s http://localhost:4000/legal/clearance | jq -r .certificate`,
    },
  ],
}

export default config
