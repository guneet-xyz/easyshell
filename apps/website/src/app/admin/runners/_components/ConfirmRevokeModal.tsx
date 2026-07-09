"use client"

import { Button } from "@/components/ui/button"

export function ConfirmRevokeModal({
  runnerName,
  runnerId,
  onConfirm,
  onCancel,
}: {
  runnerName: string
  runnerId: string
  onConfirm: () => void
  onCancel: () => void
}) {
  const warning = `Revoking runner ${runnerName} (${runnerId}) is PERMANENT. The runner row is preserved for audit history but the token stops working immediately and the runner will no longer receive dispatches. One in-flight dispatched job may still complete (accepted R1 tradeoff). This action cannot be undone. Continue?`

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-md border bg-white p-6 shadow-lg dark:bg-gray-900">
        <h2 className="mb-3 text-lg font-bold">Revoke runner</h2>
        <p className="mb-4 text-sm text-gray-700 dark:text-gray-300">
          {warning}
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel} type="button">
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm} type="button">
            Revoke runner
          </Button>
        </div>
      </div>
    </div>
  )
}
