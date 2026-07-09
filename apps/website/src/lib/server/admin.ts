import { eq } from "drizzle-orm"
import { redirect } from "next/navigation"
import { users } from "@easyshell/db/schema"
import { db } from "@/db"
import { env } from "@/env"
import { auth } from "@/lib/server/auth"

function parseAdminEmails(raw: string): Set<string> {
  return new Set(raw.split(",").map((s) => s.trim().toLowerCase()).filter((s) => s.length > 0))
}

const ADMIN_EMAIL_SET = parseAdminEmails(env.ADMIN_EMAILS)

export type AdminUser = { id: string; email: string; name: string; username: string }

/**
 * Server-side guard for admin routes. Returns the authenticated admin user or
 * triggers a redirect (Next.js `redirect()` throws internally, so control does
 * not return to the caller when the user is unauthenticated/not-admin).
 *
 * Auth model:
 * - Admin identity = NextAuth session + email in ADMIN_EMAILS.
 * - Session type does NOT include email (auth.ts:211-224); email is resolved
 *   from the users table by user.id.
 * - Unauthenticated -> redirect to /login?callback=/admin/runners.
 * - Authenticated but not admin -> throw Response(403).
 */
export async function requireAdmin(pathname: string): Promise<AdminUser> {
  const session = await auth()
  if (!session?.user) redirect(`/login?callback=${encodeURIComponent(pathname)}`)
  const rows = await db.select({ id: users.id, email: users.email, name: users.name, username: users.username })
    .from(users).where(eq(users.id, session.user.id)).limit(1)
  const user = rows[0]
  if (!user?.email) redirect(`/login?callback=${encodeURIComponent(pathname)}`)
  if (!ADMIN_EMAIL_SET.has(user.email.trim().toLowerCase())) {
    throw new Response("Forbidden", { status: 403 })
  }
  return { id: user.id, email: user.email, name: user.name ?? "", username: user.username ?? "" }
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false
  return ADMIN_EMAIL_SET.has(email.trim().toLowerCase())
}
