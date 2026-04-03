import { render } from "@react-email/render"
import { createTransport, type Transporter } from "nodemailer"
import type { ReactElement } from "react"

import { env } from "@/env"

let transporter: Transporter | null = null

export function getTransport() {
  if (!transporter) {
    transporter = createTransport({
      host: env.SMTP_HOST,
      port: 587,
      secure: false,
      auth: {
        user: env.SMTP_USERNAME,
        pass: env.SMTP_PASSWORD,
      },
    })
  }
  return transporter
}

export async function sendMail({
  to,
  subject,
  react,
}: {
  to: string
  subject: string
  react: ReactElement
}) {
  const html = await render(react)
  const transport = getTransport()

  await transport.sendMail({
    from: env.SMTP_MAIL_FROM,
    to,
    subject,
    html,
  })
}
