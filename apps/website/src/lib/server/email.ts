import { SendEmailCommand, SESv2Client } from "@aws-sdk/client-sesv2"

import { env } from "@/env"

let client: SESv2Client | undefined

/** Send one email through the Amazon SES API (fail closed without EMAIL_FROM). */
export async function sendEmail({
  to,
  subject,
  text,
  html,
}: {
  to: string
  subject: string
  text: string
  html: string
}) {
  if (!env.EMAIL_FROM) throw new Error("EMAIL_FROM is not configured")
  client ??= new SESv2Client({ region: env.AWS_REGION })
  await client.send(
    new SendEmailCommand({
      FromEmailAddress: env.EMAIL_FROM,
      Destination: { ToAddresses: [to] },
      ConfigurationSetName: env.SES_CONFIGURATION_SET,
      Content: {
        Simple: {
          Subject: { Data: subject, Charset: "UTF-8" },
          Body: {
            Text: { Data: text, Charset: "UTF-8" },
            Html: { Data: html, Charset: "UTF-8" },
          },
        },
      },
    }),
  )
}
