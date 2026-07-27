import { env } from "@/env"

import * as schema from "./schema"

import { drizzle } from "drizzle-orm/node-postgres"

export const db = drizzle({
  connection: env.DATABASE_URL,
  schema: schema,
})
