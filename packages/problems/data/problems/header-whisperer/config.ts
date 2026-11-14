import { cp, writeFile } from "fs/promises"

import type { ProblemConfig } from "@easyshell/problems/schema"

const SLUG = "header-whisperer"

const BODY = `Nothing to see here.
There are definitely no secrets in this response.
Especially not in the headers. Why would you even look there? 👀
`

async function testcaseConfig({
  id,
  isPublic,
  codename,
  headers,
}: {
  id: number
  isPublic: boolean
  codename: string
  headers: Record<string, string>
}): Promise<ProblemConfig["testcases"][number]> {
  return {
    id: id,
    public: isPublic,
    expected_stdout: codename,
    daemonSetup: async ({ image_dir, problem_dir }) => {
      await cp(`${problem_dir}/daemon`, `${image_dir}/daemon`, {
        recursive: true,
      })
      await writeFile(
        `${image_dir}/daemon/data.json`,
        JSON.stringify({ codename, headers, body: BODY }),
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
  id: 75,
  slug: SLUG,
  title: "Header Whisperer",
  description: `The backend dev is too shy to say it out loud, so the server whispers it in a header. Eavesdrop. 📨`,
  difficulty: "easy",
  tags: ["curl", "grep"],
  testcases: [
    await testcaseConfig({
      id: 1,
      isPublic: true,
      codename: "Bluebird",
      headers: {
        "X-Powered-By": "Three hamsters in a trench coat",
      },
    }),
    await testcaseConfig({
      id: 2,
      isPublic: true,
      codename: "Kingfisher",
      headers: {
        "X-Secret-Snack": "Cold pizza",
        "X-Powered-By": "Spite",
      },
    }),
    await testcaseConfig({
      id: 3,
      isPublic: false,
      codename: "Nightjar",
      headers: {
        "X-Secret-Codename-Old": "Bluebird",
        "X-Not-Secret-Codename": "Seagull",
        "X-Secret-Codenames-Rejected": "Melon's Revenge, Bird Is The Word",
        "X-Secret-Snack": "Grandma's cookies",
      },
    }),
    await testcaseConfig({
      id: 4,
      isPublic: false,
      codename: "Operation: Midnight Snack",
      headers: {
        "X-Secret-Codename-Backup": "Plan B",
        "X-Secret-Mood": "Nervous",
      },
    }),
  ],
  tests: [
    {
      testcase: "all",
      pass: true,
      input: `curl -s -D - -o /dev/null http://localhost:4000/ | grep -i '^x-secret-codename:' | cut -d ' ' -f 2- | tr -d '\\r'`,
    },
    {
      testcase: "all",
      pass: true,
      input: `curl -s -o /dev/null -w '%header{x-secret-codename}' http://localhost:4000/`,
    },
    {
      testcase: "all",
      pass: true,
      input: `curl -sI localhost:4000/ | tr -d '\\r' | sed -n 's/^[Xx]-[Ss]ecret-[Cc]odename: //p'`,
    },
    {
      testcase: "all",
      pass: false,
      input: `curl -s -D - -o /dev/null http://localhost:4000/ | grep -i '^x-secret-codename:' | cut -d ' ' -f 2-`,
    },
    {
      testcase: [3, 4],
      pass: false,
      input: `curl -sI localhost:4000/ | grep -i 'secret-codename' | cut -d ':' -f 2 | tr -d ' \\r'`,
    },
  ],
}

export default config
