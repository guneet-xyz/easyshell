import { createDb } from "@easyshell/db"

import { env } from "@/env"

export const db = createDb(env.DATABASE_URL)
