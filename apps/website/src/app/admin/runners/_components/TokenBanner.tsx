"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"

export function TokenBanner({
  runnerId,
  token,
  operation,
}: {
  runnerId: string
  token: string
  operation: "create" | "rotate"
}) {
  const [copied, setCopied] = useState(false)

  const heading =
    operation === "create" ? "New runner token" : "Rotated runner token"
  const description =
    operation === "create"
      ? "Set RUNNER_ID and RUNNER_TOKEN in the runner's env before starting the container."
      : "The previous token no longer works. Redeploy the runner with the new token before it hits the coordinator with the old one, or expect brief 401s during the swap."

  async function copy() {
    try {
      await navigator.clipboard.writeText(token)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // fail silently — user can copy manually
    }
  }

  return (
    <div className="rounded-md border border-yellow-500 bg-yellow-50 p-4 text-sm dark:bg-yellow-900/20">
      <h3 className="mb-2 font-bold text-yellow-900 dark:text-yellow-200">
        {heading}
      </h3>
      <p className="mb-3 text-yellow-900 dark:text-yellow-200">{description}</p>
      <p className="mb-3 font-semibold text-red-700 dark:text-red-400">
        This token will not be shown again. Copy it now.
      </p>
      <div className="mb-2">
        <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">
          RUNNER_ID
        </label>
        <code className="block break-all rounded bg-white px-3 py-2 font-mono text-xs dark:bg-gray-800">
          {runnerId}
        </code>
      </div>
      <div className="mb-3">
        <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">
          RUNNER_TOKEN
        </label>
        <code className="block break-all rounded bg-white px-3 py-2 font-mono text-xs dark:bg-gray-800">
          {token}
        </code>
      </div>
      <Button size="sm" onClick={copy} type="button">
        {copied ? "Copied!" : "Copy token"}
      </Button>
    </div>
  )
}
