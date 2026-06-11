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
  replace: { id: number; content: string; author: string; token: string }
}): Promise<ProblemConfig["testcases"][number]> {
  return {
    id: id,
    public: isPublic,
    expected_stdout: (replace.id + 1).toString(),
    daemonSetup: async ({ image_dir, problem_dir, testcase_dir }) => {
      await cp(`${problem_dir}/daemon`, `${image_dir}/daemon`, {
        recursive: true,
      })
      await writeFile(`${testcase_dir}/token.txt`, replace.token, "utf-8")

      let mainGo = await readFile(`${image_dir}/daemon/main.go`, "utf-8")
      mainGo = mainGo.replaceAll("__ID__", replace.id.toString())
      mainGo = mainGo.replaceAll("__CONTENT__", replace.content)
      mainGo = mainGo.replaceAll("__AUTHOR__", replace.author)
      mainGo = mainGo.replaceAll("__TOKEN__", replace.token)
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
  id: 12,
  slug: "post-with-token",
  title: "Make a POST Request using an Auth Token",
  difficulty: "medium",
  description: `Your boss is mad! Do it again and do it right.`,
  tags: ["curl", "jq"],
  testcases: [
    await testcaseConfig({
      id: 1,
      isPublic: true,
      replace: {
        id: 1234,
        content: "Chicken Jockey!",
        author: "Jack Black",
        token: "pWCB9FtISBilgXOPyWdEcSXLHAEjwebPbDTdF12vDuUKeDTM",
      },
    }),
    await testcaseConfig({
      id: 2,
      isPublic: false,
      replace: {
        id: 2345,
        content: "First we mine, then we craft. Let's Minecraft!",
        author: "Also Jack Black",
        token: "GBRm5QaHFCyEBXCkdyFeOffDDzqY6wcYjXCpEi8elArxOJ2J",
      },
    }),
  ],
  tests: [
    {
      testcase: "all",
      pass: true,
      input: `curl -s -XPOST http://localhost:4000/new-post -H "Authorization: Bearer \$(cat token.txt)" -d '{"content": "test"}' | jq .post_id`,
    },
  ],
}

export default config
