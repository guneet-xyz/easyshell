"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { createRunner } from "@/lib/server/actions/admin-runners"

import { TokenBanner } from "./TokenBanner"

type CreatedRunner = { runner_id: string; runner_token: string }

export function CreateRunnerForm() {
  const [name, setName] = useState("")
  const [publicUrl, setPublicUrl] = useState("")
  const [region, setRegion] = useState("")
  const [labelsJson, setLabelsJson] = useState("")
  const [sessionConcurrency, setSessionConcurrency] = useState(64)
  const [submissionConcurrency, setSubmissionConcurrency] = useState(4)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [created, setCreated] = useState<CreatedRunner | null>(null)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      let labels: Record<string, string> | undefined = undefined
      if (labelsJson.trim().length > 0) {
        try {
          const parsed = JSON.parse(labelsJson) as unknown
          if (
            parsed === null ||
            typeof parsed !== "object" ||
            Array.isArray(parsed)
          ) {
            throw new Error("labels must be a JSON object")
          }
          const entries = Object.entries(parsed as Record<string, unknown>)
          for (const [k, v] of entries) {
            if (typeof v !== "string") {
              throw new Error(`labels.${k} must be a string`)
            }
          }
          labels = parsed as Record<string, string>
        } catch (parseErr) {
          throw new Error(
            `Invalid labels JSON: ${
              parseErr instanceof Error ? parseErr.message : String(parseErr)
            }`,
          )
        }
      }

      const result = await createRunner({
        name,
        public_url: publicUrl,
        region: region.trim().length > 0 ? region : undefined,
        labels,
        capabilities: [
          { mode: "session", concurrency: sessionConcurrency },
          { mode: "submission", concurrency: submissionConcurrency },
        ],
      })
      setCreated({
        runner_id: result.runner_id,
        runner_token: result.runner_token,
      })
      setName("")
      setPublicUrl("")
      setRegion("")
      setLabelsJson("")
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      {created ? (
        <TokenBanner
          runnerId={created.runner_id}
          token={created.runner_token}
          operation="create"
        />
      ) : null}
      <form onSubmit={onSubmit} className="space-y-3">
        <div>
          <label className="mb-1 block text-sm font-medium">
            Name <span className="text-red-500">*</span>
          </label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="dev-runner-1"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">
            Public URL <span className="text-red-500">*</span>
          </label>
          <Input
            value={publicUrl}
            onChange={(e) => setPublicUrl(e.target.value)}
            required
            type="url"
            placeholder="http://runner-1:4200"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Region</label>
          <Input
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            placeholder="us-east-1"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">
            Labels (JSON)
          </label>
          <Textarea
            value={labelsJson}
            onChange={(e) => setLabelsJson(e.target.value)}
            placeholder='{"tier": "prod"}'
            rows={3}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium">
              Session concurrency <span className="text-red-500">*</span>
            </label>
            <Input
              type="number"
              min={1}
              value={sessionConcurrency}
              onChange={(e) =>
                setSessionConcurrency(parseInt(e.target.value, 10) || 1)
              }
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">
              Submission concurrency <span className="text-red-500">*</span>
            </label>
            <Input
              type="number"
              min={1}
              value={submissionConcurrency}
              onChange={(e) =>
                setSubmissionConcurrency(parseInt(e.target.value, 10) || 1)
              }
              required
            />
          </div>
        </div>
        {error ? (
          <div className="rounded-md border border-red-500 bg-red-50 p-3 text-sm text-red-900 dark:bg-red-900/20 dark:text-red-200">
            {error}
          </div>
        ) : null}
        <Button type="submit" disabled={submitting}>
          {submitting ? "Creating..." : "Create runner"}
        </Button>
      </form>
    </div>
  )
}
