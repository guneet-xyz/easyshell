import type { FsType, ProblemConfig } from "@easyshell/problems/schema"
import { getFs, PROBLEMS_DIR } from "@easyshell/utils/build"

const SLUG = "double-trouble"

async function testcaseConfig({
  id,
  isPublic,
}: {
  id: number
  isPublic: boolean
}): Promise<ProblemConfig["testcases"][number]> {
  const originalFs = await getFs(`${PROBLEMS_DIR}/${SLUG}/testcases/${id}`)
  // Names are ASCII, so the default sort is the byte order `sort` uses in the
  // container: in each group of identical memes the first name survives.
  const survivors = new Map<string, string>()
  for (const path of Object.keys(originalFs).toSorted()) {
    const content = originalFs[path]!
    if (!survivors.has(content)) survivors.set(content, path)
  }
  const newFs: FsType = {}
  for (const [content, path] of survivors) newFs[path] = content

  return {
    id: id,
    public: isPublic,
    expected_fs: newFs,
  }
}

const config: ProblemConfig = {
  id: 64,
  slug: SLUG,
  title: "Double Trouble",
  description: `You saved the same frog meme four times. Keep one, free the rest. 🐸`,
  difficulty: "medium",
  tags: ["md5sum", "sort", "awk", "rm"],
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
      input: `cd memes && md5sum * | sort | awk 'seen[$1]++ { sub(/^[^ ]+  /, ""); print }' | while IFS= read -r f; do rm "$f"; done`,
    },
    {
      testcase: "all",
      pass: true,
      input: `cd memes
for f in *; do
  for g in *; do
    [ "$g" = "$f" ] && break
    if [ -f "$g" ] && cmp -s "$g" "$f"; then
      rm "$f"
      break
    fi
  done
done`,
    },
    {
      testcase: "all",
      pass: true,
      input: `sha256sum memes/* | sort -k 2 | awk '{ hash = substr($0, 1, 64); if (hash in kept) print substr($0, 67); else kept[hash] = 1 }' | while IFS= read -r f; do rm "$f"; done`,
    },
    {
      testcase: "all",
      pass: false,
      input: `cd memes && rm -f *copy* *final* *'('*`,
    },
    {
      testcase: "all",
      pass: false,
      input: `cd memes && md5sum * | sort -r | awk 'seen[$1]++ { sub(/^[^ ]+  /, ""); print }' | while IFS= read -r f; do rm "$f"; done`,
    },
    {
      testcase: [4],
      pass: false,
      input: `cd memes && rm $(md5sum * | sort | awk 'seen[$1]++ { print $2 }')`,
    },
  ],
}

export default config
