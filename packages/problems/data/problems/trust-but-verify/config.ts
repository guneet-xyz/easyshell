import { createHash } from "crypto"
import { readFile } from "fs/promises"

import type { ProblemConfig } from "@easyshell/problems/schema"
import { testcaseDir } from "@easyshell/utils/build"

const SLUG = "trust-but-verify"

async function testcaseConfig({
  id,
  isPublic,
}: {
  id: number
  isPublic: boolean
}): Promise<ProblemConfig["testcases"][number]> {
  const downloads = `${testcaseDir(SLUG, id)}/downloads`
  const sums = await readFile(`${downloads}/SHA256SUMS`, "utf-8")

  const tampered: Array<string> = []
  for (const line of sums.trim().split("\n")) {
    const [, expected, name] = line.match(/^([0-9a-f]{64}) {2}(.+)$/)!
    const actual = createHash("sha256")
      .update(await readFile(`${downloads}/${name}`))
      .digest("hex")
    if (actual !== expected) tampered.push(name!)
  }

  return {
    id: id,
    public: isPublic,
    expected_stdout:
      tampered.length > 0 ? tampered.toSorted().join("\n") : "ALL CLEAR",
  }
}

const config: ProblemConfig = {
  id: 87,
  slug: SLUG,
  title: "Trust but Verify",
  description: `You downloaded everything from a sketchy mirror. Which files were tampered with? 🧪`,
  difficulty: "medium",
  tags: ["sha256sum", "grep"],
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
      input: `cd downloads
bad=$(sha256sum -c SHA256SUMS 2>/dev/null | grep ': FAILED$' | sed 's/: FAILED$//' | sort)
if [ -n "$bad" ]; then echo "$bad"; else echo "ALL CLEAR"; fi`,
    },
    {
      testcase: "all",
      pass: true,
      input: `cd downloads
while read -r sum name; do
  [ "$(sha256sum "$name" | cut -d' ' -f1)" = "$sum" ] || echo "$name"
done < SHA256SUMS | sort > /tmp/tampered
if [ -s /tmp/tampered ]; then cat /tmp/tampered; else echo "ALL CLEAR"; fi`,
    },
    {
      testcase: "all",
      pass: true,
      input: `cd downloads && sha256sum -c SHA256SUMS 2>/dev/null | sed -n 's/: FAILED$//p' | sort | grep . || echo "ALL CLEAR"`,
    },
    {
      testcase: [3, 4],
      pass: false,
      input: `cd downloads && sha256sum -c SHA256SUMS | grep FAILED | cut -d: -f1 | sort`,
    },
    {
      testcase: "all",
      pass: false,
      input: `cd downloads && sha256sum * | grep -vxFf SHA256SUMS | cut -c67- | sort | grep . || echo "ALL CLEAR"`,
    },
  ],
}

export default config
