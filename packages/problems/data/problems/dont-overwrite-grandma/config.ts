import type { ProblemConfig } from "@easyshell/problems/schema"
import { getFs, testcaseDir } from "@easyshell/utils/build"

const SLUG = "dont-overwrite-grandma"
const LINE = "- 1 pinch of shell magic\n"

async function testcaseConfig({
  id,
  isPublic,
}: {
  id: number
  isPublic: boolean
}): Promise<ProblemConfig["testcases"][number]> {
  const originalFs = await getFs(testcaseDir(SLUG, id))

  return {
    id: id,
    public: isPublic,
    expected_fs: {
      ...originalFs,
      "recipes.txt": originalFs["recipes.txt"] + LINE,
    },
  }
}

const config: ProblemConfig = {
  id: 27,
  slug: SLUG,
  title: "Don't Overwrite Grandma",
  description: `Add your secret ingredient to Grandma's recipe book. Do NOT lose her lasagna. 👵`,
  difficulty: "easy",
  tags: ["echo", "redirection"],
  testcases: [
    await testcaseConfig({ id: 1, isPublic: true }),
    await testcaseConfig({ id: 2, isPublic: true }),
    await testcaseConfig({ id: 3, isPublic: false }),
  ],
  tests: [
    {
      testcase: "all",
      pass: true,
      input: `echo "- 1 pinch of shell magic" >> recipes.txt`,
    },
    {
      testcase: "all",
      pass: true,
      input: `printf '%s\\n' '- 1 pinch of shell magic' >> recipes.txt`,
    },
    {
      testcase: "all",
      pass: true,
      input: `cat >> recipes.txt <<'EOF'\n- 1 pinch of shell magic\nEOF`,
    },
    {
      testcase: "all",
      pass: false,
      input: `echo "- 1 pinch of shell magic" > recipes.txt`,
    },
    {
      testcase: "all",
      pass: false,
      input: `{ echo "- 1 pinch of shell magic"; cat recipes.txt; } > new.txt && mv new.txt recipes.txt`,
    },
  ],
}

export default config
