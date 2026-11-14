import { readFile } from "fs/promises"

import type { ProblemConfig } from "@easyshell/problems/schema"
import { testcaseDir } from "@easyshell/utils/build"

const SLUG = "caesar-salad"

function shift(text: string, k: number) {
  return text.replace(/[A-Za-z]/g, (c) => {
    const base = c <= "Z" ? 65 : 97
    return String.fromCharCode(((c.charCodeAt(0) - base + k) % 26) + base)
  })
}

async function testcaseConfig({
  id,
  isPublic,
}: {
  id: number
  isPublic: boolean
}): Promise<ProblemConfig["testcases"][number]> {
  const note = await readFile(`${testcaseDir(SLUG, id)}/note.txt`, "utf-8")

  const candidates = Array.from({ length: 25 }, (_, i) =>
    shift(note, i + 1),
  ).filter((text) => text.trimEnd().split("\n").at(-1)!.endsWith("CROUTONS!"))
  if (candidates.length !== 1) {
    throw new Error(`${SLUG} ${id}: expected exactly one matching shift`)
  }

  return {
    id: id,
    public: isPublic,
    expected_stdout: candidates[0]!,
  }
}

const config: ProblemConfig = {
  id: 88,
  slug: SLUG,
  title: "Caesar Salad",
  description: `A Caesar cipher with an unknown shift. Toss every key until the salad makes sense. 🥗`,
  difficulty: "hard",
  tags: ["tr", "for", "grep"],
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
      input: `a=abcdefghijklmnopqrstuvwxyz
A=ABCDEFGHIJKLMNOPQRSTUVWXYZ
for i in $(seq 1 25); do
  l=$(echo $a | cut -c$((i+1))-)$(echo $a | cut -c1-$i)
  u=$(echo $A | cut -c$((i+1))-)$(echo $A | cut -c1-$i)
  tr "$a$A" "$l$u" < note.txt > /tmp/try
  if tail -n 1 /tmp/try | grep -q 'CROUTONS!$'; then cat /tmp/try; fi
done`,
    },
    {
      testcase: "all",
      pass: true,
      input: `A=ABCDEFGHIJKLMNOPQRSTUVWXYZABCDEFGHIJKLMNOPQRSTUVWXYZ
a=abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyz
for k in $(seq 1 25); do
  out=$(tr 'A-Za-z' "\${A:$k:26}\${a:$k:26}" < note.txt)
  case "$(printf '%s\\n' "$out" | tail -n 1)" in
    *CROUTONS!) printf '%s\\n' "$out" ;;
  esac
done`,
    },
    {
      testcase: "all",
      pass: true,
      input: `for k in $(seq 1 25); do
  awk -v k=$k 'BEGIN { u = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"; l = tolower(u) }
  {
    out = ""
    for (i = 1; i <= length($0); i++) {
      c = substr($0, i, 1)
      if (p = index(u, c)) c = substr(u, (p - 1 + k) % 26 + 1, 1)
      else if (p = index(l, c)) c = substr(l, (p - 1 + k) % 26 + 1, 1)
      out = out c
    }
    print out
  }' note.txt > /tmp/try
  tail -n 1 /tmp/try | grep -q 'CROUTONS!$' && cat /tmp/try
done`,
    },
    {
      testcase: "all",
      pass: false,
      input: `tr 'A-Za-z' 'N-ZA-Mn-za-m' < note.txt`,
    },
    {
      testcase: 3,
      pass: false,
      input: `A=ABCDEFGHIJKLMNOPQRSTUVWXYZABCDEFGHIJKLMNOPQRSTUVWXYZ
a=abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyz
for k in $(seq 1 25); do
  out=$(tr 'A-Za-z' "\${A:$k:26}\${a:$k:26}" < note.txt)
  if echo "$out" | grep -q CROUTONS; then echo "$out"; fi
done`,
    },
  ],
}

export default config
