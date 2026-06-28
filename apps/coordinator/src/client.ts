import { createTRPCClient, httpBatchLink } from "@trpc/client"

import type { AppRouter } from "./router"

export type { AppRouter }

export function createCoordinatorClient(opts: {
  url: string
  token: string
  correlationId?: string
}) {
  return createTRPCClient<AppRouter>({
    links: [
      httpBatchLink({
        url: opts.url,
        headers() {
          return {
            Authorization: `Bearer ${opts.token}`,
            ...(opts.correlationId
              ? { "x-correlation-id": opts.correlationId }
              : {}),
          }
        },
      }),
    ],
  })
}
