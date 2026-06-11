import type { ProblemConfig } from "@easyshell/problems/schema"

import { writeFile } from "fs/promises"
import { readFile } from "fs/promises"
import { cp } from "fs/promises"

async function testcaseConfig({
  id,
  isPublic,
  replace,
}: {
  id: number
  isPublic: boolean
  replace: { id: number; content: string; author: string }
}): Promise<ProblemConfig["testcases"][number]> {
  return {
    id: id,
    public: isPublic,
    expected_stdout: (replace.id + 1).toString(),
    daemonSetup: async ({ image_dir, problem_dir }) => {
      await cp(`${problem_dir}/daemon`, `${image_dir}/daemon`, {
        recursive: true,
      })

      let mainGo = await readFile(`${image_dir}/daemon/main.go`, "utf-8")
      mainGo = mainGo.replaceAll("__ID__", replace.id.toString())
      mainGo = mainGo.replaceAll("__CONTENT__", replace.content)
      mainGo = mainGo.replaceAll("__AUTHOR__", replace.author)
      await writeFile(`${image_dir}/daemon/main.go`, mainGo)

      return `
RUN apk add go
COPY daemon /src/daemon
RUN go build -C /src/daemon -o /daemon
`
    },
  }
}

const config: ProblemConfig = {
  id: 11,
  slug: "post-it",
  title: "Make a Post Request",
  description: `Good job on fetching the most recent post! Now, let's make a post of our own.`,
  difficulty: "medium",
  tags: ["curl", "jq"],
  testcases: [
    await testcaseConfig({
      id: 1,
      isPublic: true,
      replace: {
        id: 100,
        content: "I love The Smiths.",
        author: "Summer",
      },
    }),
    await testcaseConfig({
      id: 2,
      isPublic: false,
      replace: {
        id: 444,
        content:
          "Cause I'd rather be at home playing video games\nWith the people that I've known since the glorious age.",
        author: "The Symposium",
      },
    }),
  ],
  tests: [
    {
      testcase: "all",
      pass: true,
      input: `curl -s -XPOST http://localhost:4000/new-post -d '{"content": "test", "author": "test"}' | jq .post_id`,
    },
  ],
}

export default config
