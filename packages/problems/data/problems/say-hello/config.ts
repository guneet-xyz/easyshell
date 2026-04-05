import type { ProblemConfigInput } from "@easyshell/problems/schema"

const config: ProblemConfigInput = {
  id: 1,
  slug: "say-hello",
  title: "Say Hello to the Shell",
  description: `Print "Hello, World!"—your first step into the world of shell commands.`,
  difficulty: "easy",
  tags: ["echo"],
  testcases: [
    { id: 1, public: true, expected_stdout: "Hello, World!\n", warmInstances: 1 },
  ],
  tests: [{ testcase: 1, pass: true, input: `echo "Hello, World!"` }],
}

export default config
