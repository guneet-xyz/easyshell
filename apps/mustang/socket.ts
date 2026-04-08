import * as http from "node:http"
import { join } from "node:path"
import { createInterface } from "node:readline"

import { env } from "./env"

const log = (...args: unknown[]) => console.log("[socket]", ...args)

// =============================================================================
// Unix domain socket HTTP client
// Equivalent of Go's utils.SocketClient with http.Transport.DialContext override
// =============================================================================

/** Get the socket path for a container's entrypoint process. */
export function getSocketPath(containerName: string): string {
  return join(env.WORKING_DIR, "sessions", containerName, "main.sock")
}

/**
 * Send an HTTP request over a Unix domain socket.
 * Uses node:http's socketPath option, which is the direct equivalent
 * of Go's DialContext override that dials a Unix socket.
 */
function requestOverSocket(
  socketPath: string,
  options: {
    method: string
    path?: string
    body?: string
    timeout?: number
  },
): Promise<http.IncomingMessage> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        socketPath,
        path: options.path ?? "/whatever",
        method: options.method,
        timeout: options.timeout,
      },
      (res) => resolve(res),
    )

    req.on("error", reject)
    req.on("timeout", () => {
      req.destroy(new Error("Socket request timed out"))
    })

    if (options.body !== undefined) {
      req.write(options.body)
    }
    req.end()
  })
}

/** Read an entire HTTP response body into a string. */
function readBody(res: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    res.on("data", (chunk: Buffer) => chunks.push(chunk))
    res.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")))
    res.on("error", reject)
  })
}

// =============================================================================
// Buffered exec (equivalent of handlers/exec/exec.go)
// =============================================================================

export interface ExecErrorResponse {
  critical: boolean
  message: string
  error: string
}

export type BufferedExecResult =
  | { ok: true; body: string }
  | { ok: false; statusCode: number; error: ExecErrorResponse }

/**
 * Execute a command in a container over its Unix socket (buffered response).
 * Direct port of handlers/exec/exec.go.
 */
export async function execBuffered(
  containerName: string,
  command: string,
  timeoutMs?: number,
): Promise<BufferedExecResult> {
  const socketPath = getSocketPath(containerName)
  log(`exec (buffered) -> ${containerName}: ${command.slice(0, 100)}`)

  let res: http.IncomingMessage
  try {
    res = await requestOverSocket(socketPath, {
      method: "POST",
      body: command,
      timeout: timeoutMs,
    })
  } catch (err) {
    return {
      ok: false,
      statusCode: 500,
      error: {
        critical: true,
        message: "request failed, container might be down",
        error: err instanceof Error ? err.message : String(err),
      },
    }
  }

  if (res.statusCode === 423) {
    return {
      ok: false,
      statusCode: 423,
      error: { critical: false, message: "container locked", error: "" },
    }
  }

  if (res.statusCode !== 200) {
    const errorBody = await readBody(res)
    return {
      ok: false,
      statusCode: res.statusCode ?? 500,
      error: {
        critical: true,
        message: "container error",
        error: errorBody,
      },
    }
  }

  const body = await readBody(res)
  return { ok: true, body }
}

// =============================================================================
// Streaming exec (equivalent of handlers/session/exec_stream/exec_stream.go)
// =============================================================================

/**
 * Execute a command in a container over its Unix socket and stream the
 * response line-by-line via a callback.
 *
 * Uses readline.createInterface as the equivalent of Go's bufio.Scanner.
 */
export async function execStream(
  containerName: string,
  command: string,
  onEvent: (eventType: "stdout" | "error" | "done", data: string) => void,
): Promise<void> {
  const socketPath = getSocketPath(containerName)
  log(`exec (stream) -> ${containerName}: ${command.slice(0, 100)}`)

  let res: http.IncomingMessage
  try {
    res = await requestOverSocket(socketPath, {
      method: "POST",
      body: command,
    })
  } catch (err) {
    onEvent(
      "error",
      JSON.stringify({
        message: `Request failed, container might be down: ${err instanceof Error ? err.message : String(err)}`,
      }),
    )
    onEvent("done", "{}")
    return
  }

  if (res.statusCode === 423) {
    onEvent(
      "error",
      JSON.stringify({
        message: "Container is locked (running another command)",
      }),
    )
    onEvent("done", "{}")
    return
  }

  if (res.statusCode !== 200) {
    onEvent(
      "error",
      JSON.stringify({
        message: `Container error (status ${res.statusCode})`,
      }),
    )
    onEvent("done", "{}")
    return
  }

  // Stream line-by-line (equivalent of Go's bufio.Scanner with 1MB buffer)
  const rl = createInterface({
    input: res,
    crlfDelay: Infinity,
  })

  try {
    for await (const line of rl) {
      onEvent("stdout", line)
    }
  } catch (err) {
    onEvent(
      "error",
      JSON.stringify({
        message: `Read error: ${err instanceof Error ? err.message : String(err)}`,
      }),
    )
  }

  onEvent("done", "{}")
}
