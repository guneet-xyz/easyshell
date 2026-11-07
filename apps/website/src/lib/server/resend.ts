import { env } from "@/env"

import { Resend } from "resend"

export function getResend() {
  if (!env.RESEND_API_KEY) throw new Error("RESEND_API_KEY is not configured")
  return new Resend(env.RESEND_API_KEY)
}
