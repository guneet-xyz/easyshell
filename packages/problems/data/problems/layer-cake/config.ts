import { readFile } from "fs/promises"

import type { ProblemConfig } from "@easyshell/problems/schema"
import { testcaseDir } from "@easyshell/utils/build"

const SLUG = "layer-cake"

const UNDO: Record<string, (text: string) => string> = {
  base64: (text) => Buffer.from(text, "base64").toString("utf-8"),
  rev: (text) =>
    text
      .split("\n")
      .map((line) => [...line].reverse().join(""))
      .join("\n"),
  rot13: (text) =>
    text.replace(/[A-Za-z]/g, (c) => {
      const base = c <= "Z" ? 65 : 97
      return String.fromCharCode(((c.charCodeAt(0) - base + 13) % 26) + base)
    }),
  hex: (text) => Buffer.from(text.replace(/\s/g, ""), "hex").toString("utf-8"),
}

async function testcaseConfig({
  id,
  isPublic,
}: {
  id: number
  isPublic: boolean
}): Promise<ProblemConfig["testcases"][number]> {
  const dir = testcaseDir(SLUG, id)
  const recipe = (await readFile(`${dir}/recipe.txt`, "utf-8"))
    .trim()
    .split("\n")
  let text = await readFile(`${dir}/message.txt`, "utf-8")
  for (const step of recipe.toReversed()) {
    const undo = UNDO[step]
    if (!undo) throw new Error(`${SLUG} ${id}: unknown step ${step}`)
    text = undo(text)
  }

  return {
    id: id,
    public: isPublic,
    expected_stdout: text,
  }
}

const config: ProblemConfig = {
  id: 89,
  slug: SLUG,
  title: "Layer Cake",
  description: `Your spy friend encrypted the message in seven layers. Peel them all. 🎂`,
  difficulty: "hard",
  tags: ["base64", "rev", "tr", "xxd", "while", "case"],
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
      input: `cp message.txt /tmp/cake
tac recipe.txt | while read -r step; do
  case $step in
    base64) base64 -d /tmp/cake > /tmp/layer ;;
    rev) rev /tmp/cake > /tmp/layer ;;
    rot13) tr 'A-Za-z' 'N-ZA-Mn-za-m' < /tmp/cake > /tmp/layer ;;
    hex) xxd -r -p /tmp/cake > /tmp/layer ;;
  esac
  mv /tmp/layer /tmp/cake
done
cat /tmp/cake`,
    },
    {
      testcase: "all",
      pass: true,
      input: `cmd="cat message.txt"
for step in $(tac recipe.txt); do
  case $step in
    base64) cmd="$cmd | base64 -d" ;;
    rev) cmd="$cmd | rev" ;;
    rot13) cmd="$cmd | tr A-Za-z N-ZA-Mn-za-m" ;;
    hex) cmd="$cmd | xxd -r -p" ;;
  esac
done
eval "$cmd"`,
    },
    {
      testcase: "all",
      pass: true,
      input: `text=$(cat message.txt)
for step in $(sed -n '1!G;h;$p' recipe.txt); do
  case $step in
    base64) text=$(printf '%s\\n' "$text" | base64 -d) ;;
    rev) text=$(printf '%s\\n' "$text" | rev) ;;
    rot13) text=$(printf '%s\\n' "$text" | tr 'A-Za-z' 'N-ZA-Mn-za-m') ;;
    hex) text=$(printf '%s\\n' "$text" | xxd -r -p) ;;
  esac
done
printf '%s\\n' "$text"`,
    },
    {
      testcase: "all",
      pass: false,
      input: `cp message.txt /tmp/cake
while read -r step; do
  case $step in
    base64) base64 -d /tmp/cake > /tmp/layer ;;
    rev) rev /tmp/cake > /tmp/layer ;;
    rot13) tr 'A-Za-z' 'N-ZA-Mn-za-m' < /tmp/cake > /tmp/layer ;;
    hex) xxd -r -p /tmp/cake > /tmp/layer ;;
  esac
  mv /tmp/layer /tmp/cake
done < recipe.txt
cat /tmp/cake`,
    },
  ],
}

export default config
