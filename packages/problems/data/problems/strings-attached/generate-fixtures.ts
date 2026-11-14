// Generates the `app.bin` fixtures of every testcase deterministically:
// pnpm exec tsx packages/problems/data/problems/strings-attached/generate-fixtures.ts
import { writeFile } from "fs/promises"

import { testcaseDir } from "@easyshell/utils/build"

const SLUG = "strings-attached"

const COMMON = [
  "/lib/ld-musl-aarch64.so.1",
  "libc.musl-aarch64.so.1",
  "chirpr-admin v0.4.2",
  "Usage: chirpr-admin [--login] [--reset-password]",
  "Enter admin password: ",
  "Invalid password. This incident will be reported.",
  "Welcome back, admin. Melon Usk has 3 new complaints.",
  "TODO: move the password out of the source code (lol)",
  "GCC: (Alpine 14.2.0) 14.2.0",
]

const TESTCASES: Record<number, { seed: number; strings: string[] }> = {
  1: { seed: 1, strings: ["PASSWORD=hunter2"] },
  2: { seed: 2, strings: ["PASSWORD=correct-horse-battery-staple"] },
  3: {
    seed: 9,
    strings: [
      "OLD_PASSWORD=melon123",
      "PASSWORD=Tw33t_Tw33t!",
      "BACKUP_OLD_PASSWORD=password1",
    ],
  },
  4: {
    seed: 13,
    strings: [
      "error: set PASSWORD=<value> in your environment",
      "PASSWORD_HINT=the dog's name, backwards",
      "PASSWORD=x=y+z==chirp",
    ],
  },
}

/** mulberry32, a tiny seeded PRNG. */
function prng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function generate(seed: number, extra: string[]) {
  const random = prng(seed)
  const randomBytes = (n: number) =>
    Array.from({ length: n }, () => Math.floor(random() * 256))

  // Shuffle the embedded strings so that every binary has its own layout.
  const strings = [...COMMON, ...extra]
  for (let i = strings.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[strings[i], strings[j]] = [strings[j]!, strings[i]!]
  }

  const bytes = [0x7f, 0x45, 0x4c, 0x46, 2, 1, 1, 0, ...Array(8).fill(0)]
  for (const s of strings) {
    bytes.push(...randomBytes(200 + Math.floor(random() * 400)))
    // NUL bytes around each string keep it from merging with random bytes.
    bytes.push(0, ...Buffer.from(s, "latin1"), 0)
  }
  bytes.push(...randomBytes(300))
  return Buffer.from(bytes)
}

for (const [id, { seed, strings }] of Object.entries(TESTCASES)) {
  await writeFile(
    `${testcaseDir(SLUG, Number(id))}/app.bin`,
    generate(seed, strings),
  )
}
