import type { FsType, ProblemConfig } from "@easyshell/problems/schema"
import { getFs, testcaseDir } from "@easyshell/utils/build"

const SLUG = "sort-by-extension"

/** The text after the last dot, ignoring a leading dot. */
function extension(name: string): string {
  const withoutLeadingDot = name.startsWith(".") ? name.slice(1) : name
  const index = withoutLeadingDot.lastIndexOf(".")
  return index === -1 ? "misc" : withoutLeadingDot.slice(index + 1)
}

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
    const match = path.match(/^downloads\/([^/]+)$/)
    if (match) {
      const name = match[1]!
      newFs[`downloads/${extension(name)}/${name}`] = content
    } else {
      newFs[path] = content
    }
  }

  return {
    id: id,
    public: isPublic,
    expected_fs: newFs,
  }
}

const config: ProblemConfig = {
  id: 49,
  slug: SLUG,
  title: "Sort by Extension",
  description: `Your Downloads folder is a crime scene. Organize the evidence. 🗂️`,
  difficulty: "medium",
  tags: ["mv", "for", "mkdir"],
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
      input: `cd downloads && for f in * .*; do [ -f "$f" ] || continue; case "$f" in ?*.*) e=\${f##*.};; *) e=misc;; esac; mkdir -p "$e" && mv "$f" "$e/"; done`,
    },
    {
      testcase: "all",
      pass: true,
      input: `find downloads -maxdepth 1 -type f | while IFS= read -r f; do n=\${f##*/}; e=$(printf '%s\\n' "\${n#.}" | grep -o '\\.[^.]*$' | cut -c2-); e=\${e:-misc}; mkdir -p "downloads/$e" && mv "$f" "downloads/$e/"; done`,
    },
    {
      testcase: [1, 2, 4],
      pass: true,
      input: `cd downloads && for f in * .*; do [ -f "$f" ] || continue; case "$f" in ?*.*) e=\${f#*.};; *) e=misc;; esac; mkdir -p "$e" && mv "$f" "$e/"; done`,
    },
    {
      testcase: 3,
      pass: false,
      input: `cd downloads && for f in * .*; do [ -f "$f" ] || continue; case "$f" in ?*.*) e=\${f#*.};; *) e=misc;; esac; mkdir -p "$e" && mv "$f" "$e/"; done`,
    },
    {
      testcase: 3,
      pass: false,
      input: `cd downloads && for f in *; do [ -f "$f" ] || continue; case "$f" in ?*.*) e=\${f##*.};; *) e=misc;; esac; mkdir -p "$e" && mv "$f" "$e/"; done`,
    },
    {
      testcase: 4,
      pass: false,
      input: `cd downloads && for f in * .*; do [ -f "$f" ] || continue; case "$f" in ?*.*) e=$(echo "\${f##*.}" | tr A-Z a-z);; *) e=misc;; esac; mkdir -p "$e" && mv "$f" "$e/"; done`,
    },
    {
      testcase: 4,
      pass: false,
      input: `find downloads -type f | while IFS= read -r f; do n=\${f##*/}; case "$n" in ?*.*) e=\${n##*.};; *) e=misc;; esac; mkdir -p "downloads/$e" && mv "$f" "downloads/$e/"; done`,
    },
  ],
}

export default config
