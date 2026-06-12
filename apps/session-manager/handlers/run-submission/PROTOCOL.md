# `/run-submission` Wire Protocol

Canonical specification for the async submission-job API exposed by the Session Manager. This document is the single source of truth. Every implementation, the Go handler in `apps/session-manager/handlers/run-submission/` and the TypeScript client in `apps/submission-manager/`, must conform to it exactly.

## Overview

`/run-submission` runs a single submission test case inside a fresh, throwaway Docker container, then exposes the result over a polled HTTP endpoint. The job lifecycle is:

1. Caller `POST`s a job. Server enqueues it, starts a container in the background, and returns a `job_id` immediately.
2. Caller polls `GET /run-submission/{job_id}` until status is `done` or `error`.
3. Server keeps the result in memory for a short TTL, then drops it.

Jobs are ephemeral. There is no database, no disk persistence, no cross-restart durability. If the Session Manager restarts, every in-flight and completed-but-not-yet-claimed job disappears.

## Authentication

Both endpoints require the same bearer token used by the rest of the Session Manager API.

```
Authorization: Bearer <SESSION_MANAGER_TOKEN>
```

Missing or wrong token returns `401 Unauthorized` with body `Unauthorized`.

## `POST /run-submission`

Submits a new job. Returns immediately with a `job_id`; the actual container run happens in the background.

### Request

```
POST /run-submission HTTP/1.1
Authorization: Bearer <token>
Content-Type: application/json
```

```json
{
  "image": "easyshell-problem-foo",
  "input": "#!/bin/sh\necho hello\n",
  "metadata": {
    "submission_id": 1234,
    "testcase_id": 7,
    "problem_slug": "foo"
  }
}
```

#### Field semantics

| Field                       | Type     | Required | Notes                                                                                  |
| --------------------------- | -------- | -------- | -------------------------------------------------------------------------------------- |
| `image`                     | `string` | yes      | Image name, same form `/create` accepts. Registry prefix added by server.              |
| `input`                     | `string` | yes      | Full contents of the script to run. Written to `/input.sh` inside the container.       |
| `metadata.submission_id`    | `number` | yes      | Submission row id. Used in container name and for log correlation.                     |
| `metadata.testcase_id`      | `number` | yes      | Test case id. Used in container name and for log correlation.                          |
| `metadata.problem_slug`     | `string` | yes      | Problem slug. Used in container name and for log correlation.                          |

`pull_policy` is **not** a request field. The server's `DOCKER_REGISTRY` env var alone decides whether `--pull=always` is added, exactly like `/create`.

### Responses

#### 202 Accepted

Job was admitted. Run is in progress.

```json
{
  "job_id": "550e8400-e29b-41d4-a716-446655440000",
  "container_name": "easyshell-foo-7-submission-1234-550e8400"
}
```

| Field            | Type     | Notes                                                                                                                               |
| ---------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `job_id`         | `string` | UUID v4. Opaque to the caller. Use it as the path segment for the GET endpoint.                                                     |
| `container_name` | `string` | Server-generated. Format: `easyshell-{problem_slug}-{testcase_id}-submission-{submission_id}-{8charuuid}`. The 8-char UUID prefix is the first 8 hex chars of `job_id`, ensuring uniqueness across concurrent jobs for the same submission/testcase. |

#### 400 Bad Request

Body is not valid JSON, required fields are missing, or types are wrong. Plain-text body, e.g. `Bad Request`.

#### 401 Unauthorized

Missing or wrong bearer token. Plain-text body `Unauthorized`.

#### 503 Service Unavailable

Concurrency semaphore is full. Caller must retry later with exponential backoff.

```json
{ "error": "server at capacity" }
```

The server returns 503 *before* generating a `job_id`. There is nothing to poll, nothing to clean up. Just retry.

## `GET /run-submission/{job_id}`

Polls the status of a previously submitted job.

### Request

```
GET /run-submission/{job_id} HTTP/1.1
Authorization: Bearer <token>
```

`{job_id}` is the UUID returned by the POST.

### Responses

All successful responses use `200 OK` with a JSON body. The `status` field discriminates between three shapes.

#### `running`

The container is still executing.

```json
{ "status": "running" }
```

Caller should poll again after a short delay.

#### `done`

The container exited (cleanly or not) and the entrypoint successfully wrote `/output.json`.

```json
{
  "status": "done",
  "stdout": "hello\n",
  "stderr": "",
  "exit_code": 0,
  "fs": {
    "/home/script.sh": "#!/bin/sh\necho hello\n",
    "/home/out.txt": "hello\n"
  },
  "started_at": "2026-06-12T10:15:30.000Z",
  "finished_at": "2026-06-12T10:15:31.250Z"
}
```

| Field         | Type                       | Notes                                                                                                            |
| ------------- | -------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `status`      | `"done"`                   | Literal.                                                                                                         |
| `stdout`      | `string`                   | Full stdout of the script. Verbatim from `/output.json`.                                                         |
| `stderr`      | `string`                   | Full stderr of the script. Verbatim from `/output.json`.                                                         |
| `exit_code`   | `number`                   | Exit code of the script. Verbatim from `/output.json`.                                                           |
| `fs`          | `{ [path: string]: string }` | Map of every regular file under `/home` in the container to its UTF-8 contents. Verbatim from `/output.json`.  |
| `started_at`  | `string`                   | ISO 8601 timestamp, UTC. When the container was launched.                                                        |
| `finished_at` | `string`                   | ISO 8601 timestamp, UTC. When `/output.json` was read by the server.                                             |

The `stdout`, `stderr`, `exit_code`, and `fs` field names mirror the entrypoint's `/output.json` exactly. They must not be renamed.

#### `error`

The job failed before producing a valid `/output.json`. Causes include: container crashed before writing output, image pull failed, docker daemon error, output JSON malformed, container timed out.

```json
{
  "status": "error",
  "error": "container exited without writing /output.json"
}
```

| Field    | Type      | Notes                                              |
| -------- | --------- | -------------------------------------------------- |
| `status` | `"error"` | Literal.                                           |
| `error`  | `string`  | Human-readable diagnostic. Not stable for parsing. |

#### 401 Unauthorized

Missing or wrong bearer token.

#### 404 Not Found

`job_id` is unknown. Either it was never issued, or it expired (see TTL below), or the Session Manager restarted and lost it. Plain-text body `Not Found`.

Callers must treat 404 as a transient condition. The correct reaction is to requeue the work, not to fail the submission permanently.

## Concurrency

Concurrent submission runs are bounded by the env var:

```
SUBMISSION_MAX_CONCURRENCY=4
```

Default is `4`. The Session Manager keeps a counting semaphore of this size. Every successful `POST /run-submission` consumes one permit; the permit is released when the container finishes (or errors) and the result is stored.

When the semaphore is full, new POSTs return `503` immediately. The server does not queue. The caller is responsible for backoff and retry.

## TTL and cleanup

- Jobs in `running` state have no TTL. They live until the container finishes.
- Jobs in `done` or `error` state are kept in memory for **5 minutes** after completion, then removed.
- Once removed, GETs for that `job_id` return `404`.
- The container itself runs with `--rm`, so the docker filesystem is cleaned up on exit independent of the job-result TTL.

## State and durability

The job table is purely in-memory. No SQLite, no Redis, no on-disk journal.

Consequences callers must accept:

- **Restart loses everything.** A Session Manager restart drops all in-flight and completed jobs. Pollers see `404`.
- **No replay.** There is no way to look up a job from a persisted source after it is gone.
- **404 is recoverable.** Treat 404 from GET as "this job no longer exists, requeue the work from your own durable store."

The submission-manager owns the durable record (database row, retry counters, dead-letter logic). The Session Manager owns only the live execution.

## Pull policy

Image pulling follows the same rule as `/create`:

- If `DOCKER_REGISTRY` env var is set on the Session Manager, the docker run command includes `--pull=always` and the image is prefixed with `{DOCKER_REGISTRY}/easyshell/`.
- If `DOCKER_REGISTRY` is empty, the image is used as-is and no pull flag is added.

Callers cannot override this per request.

## Container name format

The server generates the container name from request metadata plus the new `job_id`:

```
easyshell-{problem_slug}-{testcase_id}-submission-{submission_id}-{first 8 hex chars of job_id}
```

Example: `easyshell-foo-7-submission-1234-550e8400`.

The 8-char UUID suffix guarantees uniqueness when the same submission/testcase is retried while a previous run is still being torn down. Callers receive the full name in the 202 response and may use it for log correlation, but they must not parse it for control flow.
