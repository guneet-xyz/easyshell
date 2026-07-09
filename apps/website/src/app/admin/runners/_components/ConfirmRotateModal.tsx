"use client"

import { Button } from "@/components/ui/button"

export function ConfirmRotateModal({
  runnerName,
  runnerId,
  onConfirm,
  onCancel,
  conflictError,
}: {
  runnerName: string
  runnerId: string
  onConfirm: () => void
  onCancel: () => void
  conflictError?: string
}) {
  const warning = `Rotating will replace the token for runner ${runnerName} (${runnerId}). The current token will stop working immediately. One in-flight dispatched job may still complete on the old token (accepted R1 tradeoff). Any subsequent runner→coordinator calls with the old token will 401 until you redeploy the runner with the new token. Continue?`

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-md border bg-white p-6 shadow-lg dark:bg-gray-900">
        <h2 className="mb-3 text-lg font-bold">Rotate runner token</h2>
        <p className="mb-4 text-sm text-gray-700 dark:text-gray-300">
          {warning}
        </p>
        {conflictError ? (
          <div className="mb-4 rounded-md border border-red-500 bg-red-50 p-3 text-sm text-red-900 dark:bg-red-900/20 dark:text-red-200">
            {conflictError}
          </div>
        ) : null}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel} type="button">
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm} type="button">
            Rotate token
          </Button>
        </div>
      </div>
    </div>
  )
}
