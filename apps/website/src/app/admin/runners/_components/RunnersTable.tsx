"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"
import {
  revokeRunner,
  rotateRunnerToken,
  type listRunners,
} from "@/lib/server/actions/admin-runners"

import { ConfirmRevokeModal } from "./ConfirmRevokeModal"
import { ConfirmRotateModal } from "./ConfirmRotateModal"
import { TokenBanner } from "./TokenBanner"

const CONFLICT_409_TEXT =
  "Another admin rotated this runner's token while you were preparing this rotation (409 CONFLICT). Refresh the page and coordinate with the other admin before retrying: (1) if they already copied the winning token and deployed the runner, DO NOT retry — the runner is already reachable and retrying would invalidate the working token; (2) if the winning token was not captured (browser refreshed / walked away) or should be invalidated for policy reasons, rotate again to generate a fresh token. The other admin's plaintext token cannot be recovered from the dashboard — it was view-once."

type Runner = Awaited<ReturnType<typeof listRunners>>["runners"][number]

type RotateState =
  | { kind: "idle" }
  | { kind: "confirming"; runner: Runner; conflictError?: string }
  | { kind: "rotating"; runner: Runner }
  | { kind: "success"; runnerId: string; token: string }

type RevokeState =
  | { kind: "idle" }
  | { kind: "confirming"; runner: Runner }
  | { kind: "revoking"; runner: Runner }

function statusBadgeClass(status: Runner["status"]): string {
  switch (status) {
    case "active":
      return "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200"
    case "draining":
    case "stale":
      return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-200"
    case "revoked":
      return "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200"
    case "deregistered":
      return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200"
  }
}

function formatRelative(date: Date | string): string {
  const d = date instanceof Date ? date : new Date(date)
  const diffMs = Date.now() - d.getTime()
  const seconds = Math.floor(diffMs / 1000)
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function summarizeCapabilities(caps: Runner["capabilities"]): string {
  return caps.map((c) => `${c.mode}:${c.concurrency}`).join(", ")
}

function isConflictError(err: unknown): boolean {
  if (err === null || typeof err !== "object") return false
  const withData = err as { data?: { code?: unknown; httpStatus?: unknown } }
  const code = withData.data?.code
  const httpStatus = withData.data?.httpStatus
  if (typeof code === "string" && code === "CONFLICT") return true
  if (typeof httpStatus === "number" && httpStatus === 409) return true
  const withMessage = err as { message?: unknown }
  if (typeof withMessage.message === "string") {
    return withMessage.message.toUpperCase().includes("CONFLICT")
  }
  return false
}

export function RunnersTable({ runners }: { runners: Runner[] }) {
  const [rotateState, setRotateState] = useState<RotateState>({ kind: "idle" })
  const [revokeState, setRevokeState] = useState<RevokeState>({ kind: "idle" })
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  async function onRotateConfirm(runner: Runner) {
    setRotateState({ kind: "rotating", runner })
    setErrorMessage(null)
    try {
      const result = await rotateRunnerToken(runner.id)
      setRotateState({
        kind: "success",
        runnerId: result.runner_id,
        token: result.runner_token,
      })
    } catch (err) {
      if (isConflictError(err)) {
        setRotateState({
          kind: "confirming",
          runner,
          conflictError: CONFLICT_409_TEXT,
        })
      } else {
        setRotateState({ kind: "idle" })
        setErrorMessage(err instanceof Error ? err.message : String(err))
      }
    }
  }

  async function onRevokeConfirm(runner: Runner) {
    setRevokeState({ kind: "revoking", runner })
    setErrorMessage(null)
    try {
      await revokeRunner(runner.id)
      setRevokeState({ kind: "idle" })
      // caller (page.tsx) should refresh; we just close the modal
      window.location.reload()
    } catch (err) {
      setRevokeState({ kind: "idle" })
      setErrorMessage(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <div className="space-y-4">
      {errorMessage ? (
        <div className="rounded-md border border-red-500 bg-red-50 p-3 text-sm text-red-900 dark:bg-red-900/20 dark:text-red-200">
          {errorMessage}
        </div>
      ) : null}

      {rotateState.kind === "success" ? (
        <TokenBanner
          runnerId={rotateState.runnerId}
          token={rotateState.token}
          operation="rotate"
        />
      ) : null}

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b bg-gray-50 dark:bg-gray-800">
              <th className="px-3 py-2 text-left font-medium">Name</th>
              <th className="px-3 py-2 text-left font-medium">Region</th>
              <th className="px-3 py-2 text-left font-medium">Status</th>
              <th className="px-3 py-2 text-left font-medium">Last seen</th>
              <th className="px-3 py-2 text-left font-medium">Capabilities</th>
              <th className="px-3 py-2 text-left font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {runners.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-3 py-6 text-center text-gray-500"
                >
                  No runners yet. Create one below.
                </td>
              </tr>
            ) : (
              runners.map((runner) => {
                const terminal =
                  runner.status === "revoked" ||
                  runner.status === "deregistered"
                return (
                  <tr
                    key={runner.id}
                    className="border-b hover:bg-gray-50 dark:hover:bg-gray-800/50"
                  >
                    <td className="px-3 py-2 font-mono">{runner.name}</td>
                    <td className="px-3 py-2">{runner.region ?? "-"}</td>
                    <td className="px-3 py-2">
                      <span
                        className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${statusBadgeClass(runner.status)}`}
                      >
                        {runner.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-gray-600 dark:text-gray-400">
                      {formatRelative(runner.last_seen_at)}
                    </td>
                    <td className="px-3 py-2 text-gray-600 dark:text-gray-400">
                      {summarizeCapabilities(runner.capabilities)}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={terminal}
                          onClick={() =>
                            setRotateState({ kind: "confirming", runner })
                          }
                        >
                          Rotate
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={terminal}
                          onClick={() =>
                            setRevokeState({ kind: "confirming", runner })
                          }
                        >
                          Revoke
                        </Button>
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {rotateState.kind === "confirming" ||
      rotateState.kind === "rotating" ? (
        <ConfirmRotateModal
          runnerName={rotateState.runner.name}
          runnerId={rotateState.runner.id}
          conflictError={
            rotateState.kind === "confirming"
              ? rotateState.conflictError
              : undefined
          }
          onConfirm={() => {
            if (rotateState.kind === "confirming") {
              void onRotateConfirm(rotateState.runner)
            }
          }}
          onCancel={() => setRotateState({ kind: "idle" })}
        />
      ) : null}

      {revokeState.kind === "confirming" ||
      revokeState.kind === "revoking" ? (
        <ConfirmRevokeModal
          runnerName={revokeState.runner.name}
          runnerId={revokeState.runner.id}
          onConfirm={() => {
            if (revokeState.kind === "confirming") {
              void onRevokeConfirm(revokeState.runner)
            }
          }}
          onCancel={() => setRevokeState({ kind: "idle" })}
        />
      ) : null}
    </div>
  )
}
