import { cp, readFile, writeFile } from "fs/promises"

import type { ProblemConfig } from "@easyshell/problems/schema"
import { testcaseDir } from "@easyshell/utils/build"

const SLUG = "grandpas-vault"

async function testcaseConfig({
  id,
  isPublic,
  treasure,
}: {
  id: number
  isPublic: boolean
  treasure: string
}): Promise<ProblemConfig["testcases"][number]> {
  const creds = (
    await readFile(`${testcaseDir(SLUG, id)}/creds.txt`, "utf-8")
  ).replace(/\n$/, "")
  const separator = creds.indexOf(":")
  const username = creds.slice(0, separator)
  const password = creds.slice(separator + 1)

  return {
    id: id,
    public: isPublic,
    expected_stdout: treasure,
    daemonSetup: async ({ image_dir, problem_dir }) => {
      await cp(`${problem_dir}/daemon`, `${image_dir}/daemon`, {
        recursive: true,
      })
      await writeFile(
        `${image_dir}/daemon/data.json`,
        JSON.stringify({ username, password, treasure }),
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
  id: 77,
  slug: SLUG,
  title: "Grandpa's Vault",
  description: `Grandpa learned web development at 82 and locked the treasure map behind Basic Auth. Bless him. 🔐`,
  difficulty: "easy",
  tags: ["curl", "jq"],
  testcases: [
    await testcaseConfig({
      id: 1,
      isPublic: true,
      treasure: "Under the third garden gnome from the left",
    }),
    await testcaseConfig({
      id: 2,
      isPublic: true,
      treasure: "Inside the cookie jar. No, the OTHER cookie jar.",
    }),
    await testcaseConfig({
      id: 3,
      isPublic: false,
      treasure: "Ten paces north of the bird bath, under the rose bush",
    }),
    await testcaseConfig({
      id: 4,
      isPublic: false,
      treasure: "Taped behind the 1974 family portrait (Kevin's not in it)",
    }),
  ],
  tests: [
    {
      testcase: "all",
      pass: true,
      input: `curl -s -u "$(cat creds.txt)" http://localhost:4000/vault | jq -r .treasure`,
    },
    {
      testcase: "all",
      pass: true,
      input: `curl -s -H "Authorization: Basic $(tr -d '\\n' < creds.txt | base64 -w 0)" localhost:4000/vault | jq -r .treasure`,
    },
    {
      testcase: "all",
      pass: true,
      input: `curl -s --basic --user "$(head -n 1 creds.txt)" localhost:4000/vault | jq -j .treasure`,
    },
    {
      testcase: "all",
      pass: false,
      input: `curl -s http://localhost:4000/vault | jq -r .treasure`,
    },
    {
      testcase: [3],
      pass: false,
      input: `curl -s -u "$(cut -d : -f 1 creds.txt):$(cut -d : -f 2 creds.txt)" http://localhost:4000/vault | jq -r .treasure`,
    },
    {
      testcase: [4],
      pass: false,
      input: `curl -s -u $(cat creds.txt) http://localhost:4000/vault | jq -r .treasure`,
    },
  ],
}

export default config
