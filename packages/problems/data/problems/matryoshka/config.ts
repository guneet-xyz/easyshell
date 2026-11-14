import { readFile } from "fs/promises"

import type { ProblemConfig } from "@easyshell/problems/schema"
import { PROBLEMS_DIR } from "@easyshell/utils/build"

const SLUG = "matryoshka"

async function testcaseConfig({
  id,
  isPublic,
}: {
  id: number
  isPublic: boolean
}): Promise<ProblemConfig["testcases"][number]> {
  // doll.tar.gz is fixtures/<id>/secret.txt in several layers (generate.sh).
  const secret = await readFile(
    `${PROBLEMS_DIR}/${SLUG}/fixtures/${id}/secret.txt`,
    "utf-8",
  )

  return {
    id: id,
    public: isPublic,
    expected_stdout: secret,
  }
}

const peelInPlace = `while [ ! -f secret.txt ]; do
  f=$(ls)
  case "$f" in
    *.tar.gz) tar -xzf "$f" && rm "$f" ;;
    *.tar.bz2) tar -xjf "$f" && rm "$f" ;;
    *.tar.xz) tar -xJf "$f" && rm "$f" ;;
    *.tar) tar -xf "$f" && rm "$f" ;;
    *.zip) unzip -q "$f" && rm "$f" ;;
    *.gz) gunzip "$f" ;;
    *.bz2) bunzip2 "$f" ;;
    *.xz) unxz "$f" ;;
  esac
done
cat secret.txt`

const config: ProblemConfig = {
  id: 61,
  slug: SLUG,
  title: "Matryoshka",
  description: `Your spy friend wrapped the intel in "a few" layers of security. It's archives all the way down. 🪆`,
  difficulty: "hard",
  tags: ["tar", "gzip", "bzip2", "xz", "unzip", "while", "case"],
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
      input: peelInPlace,
    },
    {
      testcase: "all",
      pass: true,
      input: `mkdir /tmp/dolls && cp doll.tar.gz /tmp/dolls && cd /tmp/dolls
f=doll.tar.gz
while [ "$f" != secret.txt ]; do
  case "$f" in
    *.tar | *.tar.gz | *.tar.bz2 | *.tar.xz) next=$(tar -tf "$f") && tar -xf "$f" ;;
    *.zip) next=$(unzip -Z1 "$f") && unzip -o -q "$f" ;;
    *.gz) next=\${f%.gz} && gunzip -c "$f" > "$next" ;;
    *.bz2) next=\${f%.bz2} && bunzip2 -c "$f" > "$next" ;;
    *.xz) next=\${f%.xz} && unxz -c "$f" > "$next" ;;
  esac
  f=$next
done
cat "$f"`,
    },
    {
      testcase: 1,
      pass: true,
      input: `tar -xzf doll.tar.gz && unzip -q tiny-doll.zip && gunzip secret.txt.gz && cat secret.txt`,
    },
    {
      testcase: [2, 3, 4],
      pass: false,
      input: `tar -xzf doll.tar.gz && unzip -q tiny-doll.zip && gunzip secret.txt.gz && cat secret.txt`,
    },
    {
      testcase: "all",
      pass: false,
      input: peelInPlace.replace("unzip -q", "unzip"),
    },
    {
      testcase: [3, 4],
      pass: false,
      input: peelInPlace
        .replace("while [ ! -f secret.txt ]", "for i in 1 2 3 4 5 6")
        .replace(/^done$/m, `  [ -f secret.txt ] && break\ndone`),
    },
  ],
}

export default config
