import * as schema from "@easyshell/db/schema"

import { env } from "@/env"

import { drizzle } from "drizzle-orm/node-postgres"

export const db = drizzle({
  connection: env.DATABASE_URL,
  schema: schema,
})
