import { cp, writeFile } from "fs/promises"

import type { ProblemConfig } from "@easyshell/problems/schema"

const SLUG = "pulse-check"

async function testcaseConfig({
  id,
  isPublic,
  status,
  body,
}: {
  id: number
  isPublic: boolean
  status: number
  body: string
}): Promise<ProblemConfig["testcases"][number]> {
  return {
    id: id,
    public: isPublic,
    expected_stdout: status.toString(),
    daemonSetup: async ({ image_dir, problem_dir }) => {
      await cp(`${problem_dir}/daemon`, `${image_dir}/daemon`, {
        recursive: true,
      })
      await writeFile(
        `${image_dir}/daemon/data.json`,
        JSON.stringify({ status, body }),
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
  id: 74,
  slug: SLUG,
  title: "Pulse Check",
  description: `It's 2 a.m. and the pager is screaming. Is the server alive? Just give me the number. 🩺`,
  difficulty: "easy",
  tags: ["curl"],
  testcases: [
    await testcaseConfig({
      id: 1,
      isPublic: true,
      status: 200,
      body: `<!doctype html>
<html>
  <head><title>Twitter Clone Health</title></head>
  <body>
    <h1>All systems nominal</h1>
    <p>The hamster is running. The wheel is spinning. Go back to bed.</p>
  </body>
</html>
`,
    }),
    await testcaseConfig({
      id: 2,
      isPublic: true,
      status: 503,
      body: `<!doctype html>
<html>
  <head><title>Service Unavailable</title></head>
  <body>
    <h1>The hamster is taking a nap</h1>
    <p>Please try again after the hamster has had his coffee.</p>
  </body>
</html>
`,
    }),
    await testcaseConfig({
      id: 3,
      isPublic: false,
      status: 418,
      body: `<!doctype html>
<html>
  <head><title>I'm a teapot</title></head>
  <body>
    <h1>I'm a teapot</h1>
    <p>Someone deployed the office kettle firmware to production. It is short and stout.</p>
  </body>
</html>
`,
    }),
    await testcaseConfig({
      id: 4,
      isPublic: false,
      status: 500,
      body: `<!doctype html>
<html>
  <head><title>Everything is fine</title></head>
  <body>
    <h1>Our SLA promises 200% uptime</h1>
    <p>That was a lie. Melon Usk says the servers are "hardcore" now, and they caught fire.</p>
    <p>Error code: 500</p>
  </body>
</html>
`,
    }),
  ],
  tests: [
    {
      testcase: "all",
      pass: true,
      input: `curl -s -o /dev/null -w '%{http_code}' http://localhost:4000/health`,
    },
    {
      testcase: "all",
      pass: true,
      input: `curl -sI http://localhost:4000/health | head -n 1 | cut -d ' ' -f 2`,
    },
    {
      testcase: "all",
      pass: true,
      input: `curl -s -D - -o /dev/null localhost:4000/health | head -n 1 | awk '{ print $2 }'`,
    },
    {
      testcase: "all",
      pass: false,
      input: `curl -s http://localhost:4000/health`,
    },
    {
      testcase: 4,
      pass: false,
      input: `curl -s http://localhost:4000/health | grep -o '[0-9][0-9][0-9]' | head -n 1`,
    },
  ],
}

export default config
