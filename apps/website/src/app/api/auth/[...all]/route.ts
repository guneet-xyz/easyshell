import { toNextJsHandler } from "better-auth/next-js"

import { getAuthServer } from "@/lib/server/auth"

export async function GET(request: Request) {
  return toNextJsHandler(getAuthServer()).GET(request)
}

export async function POST(request: Request) {
  return toNextJsHandler(getAuthServer()).POST(request)
}
