// ==========================================
// secret.ts — AES-256-GCM encrypt/decrypt for runner secrets at rest
//
// Runners register with a 32-byte hex secret. We keep a SHA-256 hash for
// presentation-time auth (constant-time check) AND an AES-256-GCM
// encrypted copy so the coordinator can replay the secret to the runner
// when dispatching/polling.
//
// The encryption key is `env.COORDINATOR_SECRET_KEY` (64 hex chars). When
// it is unset (dev/test boot), we fall back to a base64-encoded plaintext
// envelope with the literal nonce `"plaintext"` so test environments do
// not require a key.
// ==========================================

import crypto from "node:crypto"

import { createLogger } from "@easyshell/logger"

import { env } from "../env"

const log = createLogger("coordinator:secret")

const GCM_NONCE_BYTES = 12
const GCM_TAG_BYTES = 16
const PLAINTEXT_NONCE_MARKER = "plaintext"

export type EncryptedSecret = {
  ciphertext: string
  nonce: string
}

/**
 * Encrypts the runner's plaintext secret for at-rest storage in the
 * `runner.secret_ciphertext` / `runner.secret_nonce` columns.
 *
 * When `COORDINATOR_SECRET_KEY` is absent we store a base64-encoded
 * plaintext envelope with the literal nonce `"plaintext"` so dev/test
 * environments boot without configuring a key. PRODUCTION MUST SET A KEY.
 */
export function encryptSecret(plaintext: string): EncryptedSecret {
  if (!env.COORDINATOR_SECRET_KEY) {
    log.warn(
      "secret.encrypt.no-key — storing plaintext envelope (dev/test only)",
    )
    return {
      ciphertext: Buffer.from(plaintext, "utf8").toString("base64"),
      nonce: PLAINTEXT_NONCE_MARKER,
    }
  }

  const key = Buffer.from(env.COORDINATOR_SECRET_KEY, "hex")
  const nonce = crypto.randomBytes(GCM_NONCE_BYTES)
  const cipher = crypto.createCipheriv("aes-256-gcm", key, nonce)
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ])
  const tag = cipher.getAuthTag()

  return {
    ciphertext: Buffer.concat([encrypted, tag]).toString("base64"),
    nonce: nonce.toString("hex"),
  }
}

/**
 * Decrypts a runner secret stored via {@link encryptSecret}.
 *
 * Throws when the nonce indicates a non-plaintext envelope but the
 * coordinator has no key configured (post-key-loss recovery is out of
 * scope — re-register the runner).
 */
export function decryptSecret(ciphertext: string, nonce: string): string {
  if (nonce === PLAINTEXT_NONCE_MARKER) {
    return Buffer.from(ciphertext, "base64").toString("utf8")
  }
  if (!env.COORDINATOR_SECRET_KEY) {
    throw new Error(
      "COORDINATOR_SECRET_KEY is required to decrypt an AES-GCM runner secret",
    )
  }

  const key = Buffer.from(env.COORDINATOR_SECRET_KEY, "hex")
  const nonceBytes = Buffer.from(nonce, "hex")
  const data = Buffer.from(ciphertext, "base64")
  if (data.length < GCM_TAG_BYTES) {
    throw new Error("runner secret ciphertext is too short to contain GCM tag")
  }
  const tag = data.subarray(data.length - GCM_TAG_BYTES)
  const encrypted = data.subarray(0, data.length - GCM_TAG_BYTES)
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, nonceBytes)
  decipher.setAuthTag(tag)
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()])
  return decrypted.toString("utf8")
}
