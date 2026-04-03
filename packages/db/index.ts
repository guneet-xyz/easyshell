import * as schema from "./schema"

import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"

export function createDb(connectionString: string) {
  const client = postgres(connectionString)
  return drizzle(client, { schema })
}
