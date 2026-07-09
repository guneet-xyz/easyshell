import { createHash } from "node:crypto"

import { createDb } from "@easyshell/db"
import { runnerCapabilities, runners } from "@easyshell/db/schema"

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is required`)
  return value
}

const DATABASE_URL = requireEnv("DATABASE_URL")

// Dev runner definitions — must match compose.yml RUNNER_ID + RUNNER_TOKEN
const DEV_RUNNERS = [
  {
    id: "dev-runner-1",
    token: "dev-runner-token-1",
    name: "dev-runner-1",
    public_url: "http://runner:4200",
    capabilities: [
      { mode: "submission" as const, concurrency: 4 },
      { mode: "session" as const, concurrency: 64 },
    ],
  },
  {
    id: "dev-runner-2",
    token: "dev-runner-token-2",
    name: "dev-runner-2",
    public_url: "http://runner-2:4200",
    capabilities: [
      { mode: "submission" as const, concurrency: 4 },
      { mode: "session" as const, concurrency: 64 },
    ],
  },
]

function sha256(s: string): string {
  return createHash("sha256").update(s).digest("hex")
}

// Plaintext envelope — matches coordinator's secret.ts fallback when COORDINATOR_SECRET_KEY is not set
function encryptPlaintext(s: string): { ciphertext: string; nonce: string } {
  return {
    ciphertext: Buffer.from(s, "utf8").toString("base64"),
    nonce: "plaintext",
  }
}

async function main() {
  const db = createDb(DATABASE_URL)

  for (const r of DEV_RUNNERS) {
    const secretHash = sha256(r.token)
    const { ciphertext: secretCiphertext, nonce: secretNonce } =
      encryptPlaintext(r.token)

    await db
      .insert(runners)
      .values({
        id: r.id,
        name: r.name,
        publicUrl: r.public_url,
        secretHash,
        secretCiphertext,
        secretNonce,
        revokedAt: null,
      })
      .onConflictDoUpdate({
        target: runners.id,
        set: { secretHash, secretCiphertext, secretNonce, revokedAt: null },
      })

    for (const cap of r.capabilities) {
      await db
        .insert(runnerCapabilities)
        .values({
          runnerId: r.id,
          mode: cap.mode,
          concurrency: cap.concurrency,
        })
        .onConflictDoNothing()
    }

    console.log(`seeded ${r.id} (token=${r.token}, public_url=${r.public_url})`)
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
