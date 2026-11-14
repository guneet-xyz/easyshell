import type { FsType, ProblemConfig } from "@easyshell/problems/schema"
import { getFs, testcaseDir } from "@easyshell/utils/build"

const SLUG = "spaces-are-evil"

async function testcaseConfig({
  id,
  isPublic,
}: {
  id: number
  isPublic: boolean
}): Promise<ProblemConfig["testcases"][number]> {
  const originalFs = await getFs(testcaseDir(SLUG, id))
  const newFs: FsType = {}
  for (const [path, content] of Object.entries(originalFs)) {
    // Only files directly in the home directory are renamed.
    const newPath = path.includes("/") ? path : path.replaceAll(" ", "_")
    newFs[newPath] = content
  }

  return {
    id: id,
    public: isPublic,
    expected_fs: newFs,
  }
}

const config: ProblemConfig = {
  id: 32,
  slug: SLUG,
  title: "Spaces Are Evil",
  description: `"final report (FINAL) v2.txt". Who does this? Fix it. 😤`,
  difficulty: "medium",
  tags: ["mv", "quoting", "for"],
  testcases: [
    await testcaseConfig({ id: 1, isPublic: true }),
    await testcaseConfig({ id: 2, isPublic: true }),
    await testcaseConfig({ id: 3, isPublic: false }),
    await testcaseConfig({ id: 4, isPublic: false }),
  ],
  tests: [
    {
      testcase: "all",
      pass: true,
      input: `for f in *\\ *; do [ -f "$f" ] && mv "$f" "$(printf '%s' "$f" | tr ' ' '_')"; done`,
    },
    {
      testcase: "all",
      pass: true,
      input: `find . -maxdepth 1 -type f -name '* *' | while IFS= read -r f; do mv "$f" "$(printf '%s' "$f" | tr ' ' _)"; done`,
    },
    {
      testcase: "all",
      pass: true,
      input: `ls | while IFS= read -r f; do
  case "$f" in
    *" "*) if [ -f "$f" ]; then mv -- "$f" "$(echo "$f" | sed 's/ /_/g')"; fi ;;
  esac
done`,
    },
    {
      testcase: "all",
      pass: false,
      input: `for f in $(ls); do mv "$f" "$(echo $f | tr ' ' _)"; done`,
    },
    {
      testcase: [2, 3, 4],
      pass: false,
      input: `for f in *\\ *; do mv "$f" $(echo $f | tr ' ' _); done`,
    },
    {
      testcase: 3,
      pass: false,
      input: `for f in *\\ *; do mv "$f" "$(printf '%s' "$f" | tr ' ' _)"; done`,
    },
    {
      testcase: 3,
      pass: false,
      input: `find . -type f -name '* *' | while IFS= read -r f; do mv "$f" "$(printf '%s' "$f" | tr ' ' _)"; done`,
    },
  ],
}

export default config
