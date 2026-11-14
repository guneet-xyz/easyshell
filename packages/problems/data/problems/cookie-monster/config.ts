import { cp, readFile, writeFile } from "fs/promises"

import type { ProblemConfig } from "@easyshell/problems/schema"
import { testcaseDir } from "@easyshell/utils/build"

const SLUG = "cookie-monster"

async function testcaseConfig({
  id,
  isPublic,
  welcome,
}: {
  id: number
  isPublic: boolean
  welcome: string
}): Promise<ProblemConfig["testcases"][number]> {
  const [username, password] = (
    await readFile(`${testcaseDir(SLUG, id)}/login.txt`, "utf-8")
  ).split("\n")

  return {
    id: id,
    public: isPublic,
    expected_stdout: welcome,
    daemonSetup: async ({ image_dir, problem_dir }) => {
      await cp(`${problem_dir}/daemon`, `${image_dir}/daemon`, {
        recursive: true,
      })
      await writeFile(
        `${image_dir}/daemon/data.json`,
        JSON.stringify({ username, password, welcome }),
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
  id: 78,
  slug: SLUG,
  title: "Cookie Monster",
  description: `The server hands you a cookie when you log in. Don't eat it; you'll need it. 🍪`,
  difficulty: "medium",
  tags: ["curl", "jq"],
  testcases: [
    await testcaseConfig({
      id: 1,
      isPublic: true,
      welcome:
        "Welcome back, admin! You have 3 new followers and 0 new friends.",
    }),
    await testcaseConfig({
      id: 2,
      isPublic: true,
      welcome:
        "Welcome back, Cookie Monster! Today's metric: cookies per second.",
    }),
    await testcaseConfig({
      id: 3,
      isPublic: false,
      welcome:
        "Welcome back, Melon! You have 4,096 unread complaints from Legal.",
    }),
    await testcaseConfig({
      id: 4,
      isPublic: false,
      welcome: "Welcome back, Grandma! Your recipe post went viral. Again.",
    }),
  ],
  tests: [
    {
      testcase: "all",
      pass: true,
      input: `curl -s -c jar.txt --data-urlencode "username=$(sed -n 1p login.txt)" --data-urlencode "password=$(sed -n 2p login.txt)" http://localhost:4000/login > /dev/null
curl -s -b jar.txt http://localhost:4000/dashboard | jq -r .welcome`,
    },
    {
      testcase: "all",
      pass: true,
      input: `{ read -r user; read -r pass; } < login.txt
cookie=$(curl -s -D - -o /dev/null -F "username=$user" -F "password=$pass" localhost:4000/login | grep -i '^set-cookie:' | cut -d ' ' -f 2 | cut -d ';' -f 1)
curl -s -H "Cookie: $cookie" localhost:4000/dashboard | jq -r .welcome`,
    },
    {
      testcase: "all",
      pass: false,
      input: `curl -s http://localhost:4000/dashboard | jq -r .welcome`,
    },
    {
      testcase: "all",
      pass: false,
      input: `curl -s --data-urlencode "username=$(sed -n 1p login.txt)" --data-urlencode "password=$(sed -n 2p login.txt)" http://localhost:4000/login > /dev/null
curl -s http://localhost:4000/dashboard | jq -r .welcome`,
    },
    {
      testcase: [4],
      pass: false,
      input: `curl -s -c jar.txt -d "username=$(sed -n 1p login.txt)&password=$(sed -n 2p login.txt)" http://localhost:4000/login > /dev/null
curl -s -b jar.txt http://localhost:4000/dashboard | jq -r .welcome`,
    },
  ],
}

export default config
