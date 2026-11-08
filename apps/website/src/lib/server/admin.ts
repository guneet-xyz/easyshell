import { eq } from "drizzle-orm"
import { redirect } from "next/navigation"

import { users } from "@easyshell/db/schema"

import { db } from "@/db"
import { env } from "@/env"
import { auth } from "@/lib/server/auth"

function parseAdminEmails(raw: string): Set<string> {
  return new Set(
    raw
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter((s) => s.length > 0),
  )
}

// Parsed on first use: env values are not available while Next builds pages.
let adminEmailSet: Set<string> | undefined
function adminEmails(): Set<string> {
  adminEmailSet ??= parseAdminEmails(env.ADMIN_EMAILS)
  return adminEmailSet
}

export type AdminUser = {
  id: string
  email: string
  name: string
  username: string
}

/**
 * Server-side guard for admin routes. Returns the authenticated admin user or
 * triggers a redirect (Next.js `redirect()` throws internally, so control does
 * not return to the caller when the user is unauthenticated/not-admin).
 *
 * Auth model:
 * - Admin identity = better-auth session + verified email in ADMIN_EMAILS.
 *   OAuth sign-up accepts provider emails the provider has not verified, so
 *   an unverified address must never grant admin.
 * - Session type does NOT include email (auth.ts:211-224); email is resolved
 *   from the users table by user.id.
 * - Unauthenticated -> redirect to /login?callback=/admin/runners.
 * - Authenticated but not admin -> throw Response(403).
 */
export async function requireAdmin(pathname: string): Promise<AdminUser> {
  const session = await auth()
  if (!session?.user)
    redirect(`/login?callback=${encodeURIComponent(pathname)}`)
  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      emailVerified: users.emailVerified,
      name: users.name,
      username: users.username,
    })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1)
  const user = rows[0]
  if (!user?.email) redirect(`/login?callback=${encodeURIComponent(pathname)}`)
  if (
    !user.emailVerified ||
    !adminEmails().has(user.email.trim().toLowerCase())
  ) {
    throw new Response("Forbidden", { status: 403 })
  }
  return {
    id: user.id,
    email: user.email,
    name: user.name ?? "",
    username: user.username ?? "",
  }
}
