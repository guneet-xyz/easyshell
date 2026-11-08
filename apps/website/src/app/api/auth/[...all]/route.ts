import { toNextJsHandler } from "better-auth/next-js"

import { authServer } from "@/lib/server/auth"

export const { GET, POST } = toNextJsHandler(authServer)
