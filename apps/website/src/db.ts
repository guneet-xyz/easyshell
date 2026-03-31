import { createDb } from "@easyshell/db"

import { env } from "@/env"

export const db = createDb(env.DRIZZLE_PROXY_URL, env.DRIZZLE_PROXY_TOKEN)
