import crypto from "node:crypto"

/**
 * Generates a globally unique Docker container name.
 * Format: `easyshell-{uuidv4}` (e.g. `easyshell-550e8400-e29b-41d4-a716-446655440000`).
 *
 * The result matches the regex
 * `^easyshell-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$`.
 */
export function generateContainerName(): string {
  return `easyshell-${crypto.randomUUID()}`
}
