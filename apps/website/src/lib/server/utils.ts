// ====================================================
// Utility function that can be used ONLY on the server
// ====================================================
import { headers } from "next/headers"

export async function getPathname() {
  return (await headers()).get("x-pathname") ?? "/"
}
