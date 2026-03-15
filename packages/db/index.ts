import * as schema from "./schema"

import axios from "axios"
import { drizzle } from "drizzle-orm/pg-proxy"

export function createDb(proxyUrl: string, proxyToken: string) {
  const endpoint = `${proxyUrl}/query`
  const authHeader = `Bearer ${proxyToken}`

  return drizzle(
    async (sql, params, method) => {
      try {
        // I have no idea why this doesn't work with fetch()
        const rows: { data: unknown[] } = await axios.post(
          endpoint,
          { sql, params, method },
          {
            headers: {
              Authorization: authHeader,
            },
          },
        )

        return { rows: rows.data }
      } catch (e) {
        console.error("Error during db query", e)
        return { rows: [] }
      }
    },
    {
      schema: schema,
    },
  )
}
