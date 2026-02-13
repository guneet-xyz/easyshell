import { env } from "@/env"

import { Resend } from "resend"

export function getResend() {
  return new Resend(env.RESEND_API_KEY)
}
