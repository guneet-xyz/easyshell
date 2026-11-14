import { cp, writeFile } from "fs/promises"

import type { ProblemConfig } from "@easyshell/problems/schema"

const SLUG = "try-try-again"

const SLEEPY_ERRORS = [
  "503 Service Unavailable: the server is still asleep. Zzz...\n",
  "503 Service Unavailable: the server hit snooze.\n",
  "503 Service Unavailable: the server is looking for its glasses.\n",
]

async function testcaseConfig({
  id,
  isPublic,
  failures,
  errors = SLEEPY_ERRORS,
  fortune,
}: {
  id: number
  isPublic: boolean
  failures: number
  errors?: Array<string>
  fortune: string
}): Promise<ProblemConfig["testcases"][number]> {
  return {
    id: id,
    public: isPublic,
    expected_stdout: fortune,
    daemonSetup: async ({ image_dir, problem_dir }) => {
      await cp(`${problem_dir}/daemon`, `${image_dir}/daemon`, {
        recursive: true,
      })
      await writeFile(
        `${image_dir}/daemon/data.json`,
        JSON.stringify({ failures, errors, fortune }),
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
  id: 82,
  slug: SLUG,
  title: "Try, Try Again",
  description: `The fortune server is having a bad day. Keep asking nicely until it answers. 🔁`,
  difficulty: "medium",
  tags: ["curl", "until"],
  testcases: [
    await testcaseConfig({
      id: 1,
      isPublic: true,
      failures: 2,
      fortune: "A bug you fixed today will come back on Friday at 4:59 p.m.\n",
    }),
    await testcaseConfig({
      id: 2,
      isPublic: true,
      failures: 0,
      fortune: "You will finally understand regular expressions. Not today.\n",
    }),
    await testcaseConfig({
      id: 3,
      isPublic: false,
      failures: 5,
      fortune: `Persistence pays off.
(Unlike the free tier, which doesn't pay at all.)
`,
    }),
    await testcaseConfig({
      id: 4,
      isPublic: false,
      failures: 3,
      errors: [
        "Your fortune: a 503 is in your future.\n",
        "Your fortune: you will try again. And again.\n",
        "Your fortune: patience is a virtue. Also, this is an error.\n",
      ],
      fortune: "Your fortune: Melon Usk will follow you back. Run.\n",
    }),
  ],
  tests: [
    {
      testcase: "all",
      pass: true,
      input: `until out=$(curl -sf http://localhost:4000/fortune); do :; done
echo "$out"`,
    },
    {
      testcase: "all",
      pass: true,
      input: `curl -sf --retry 10 --retry-delay 1 http://localhost:4000/fortune`,
    },
    {
      testcase: "all",
      pass: true,
      input: `while true; do
  code=$(curl -s -o body.txt -w '%{http_code}' localhost:4000/fortune)
  [ "$code" = 200 ] && break
done
cat body.txt`,
    },
    {
      testcase: [1, 3, 4],
      pass: false,
      input: `curl -s http://localhost:4000/fortune`,
    },
    {
      testcase: [1, 3, 4],
      pass: false,
      input: `curl -s --retry 10 --retry-delay 1 http://localhost:4000/fortune`,
    },
    {
      testcase: [4],
      pass: false,
      input: `until out=$(curl -s http://localhost:4000/fortune | grep 'fortune'); do :; done
echo "$out"`,
    },
  ],
}

export default config
