import { createEnv } from "@t3-oss/env-core"
import { z } from "zod"

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().url(),

    // Legacy names; better-auth reads BETTER_AUTH_SECRET and BETTER_AUTH_URL.
    NEXTAUTH_SECRET: z.string().optional(),
    NEXTAUTH_URL: z.string().url().optional(),

    // Each OAuth provider is enabled only when both of its values are set.
    DISCORD_CLIENT_ID: z.string().optional(),
    DISCORD_CLIENT_SECRET: z.string().optional(),

    GITHUB_CLIENT_ID: z.string().optional(),
    GITHUB_CLIENT_SECRET: z.string().optional(),

    GOOGLE_CLIENT_ID: z.string().optional(),
    GOOGLE_CLIENT_SECRET: z.string().optional(),

    // Email (magic link) sign-in through Amazon SES is enabled when EMAIL_FROM
    // is set. AWS credentials come from the standard AWS_* variables.
    EMAIL_FROM: z.string().optional(),
    AWS_REGION: z.string().default("us-east-1"),
    SES_CONFIGURATION_SET: z.string().optional(),

    SESSION_MANAGER_URL: z.string().url(),
    SESSION_MANAGER_TOKEN: z.string(),

    RESEND_API_KEY: z.string().optional(),
  },
  clientPrefix: "NEXT_PUBLIC_",
  client: {
    NEXT_PUBLIC_POSTHOG_KEY: z.string().optional(),
  },
  runtimeEnv: {
    ...process.env,
    NEXT_PUBLIC_POSTHOG_KEY: process.env.NEXT_PUBLIC_POSTHOG_KEY,
  },
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true,
})
