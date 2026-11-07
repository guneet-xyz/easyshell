import * as schema from "./schema"

import { drizzle } from "drizzle-orm/node-postgres"

// Shared by non-website apps; each app validates DATABASE_URL in its own env.
export const db = drizzle({
  connection: process.env.DATABASE_URL!,
  schema: schema,
})
