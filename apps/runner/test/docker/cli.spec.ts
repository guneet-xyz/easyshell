// ==========================================
// Unit tests for the Docker CLI adapter.
//
// We mock `node:child_process.execFile` and replace `node:util.promisify`
// with an identity passthrough so `execFileAsync` IS the mocked execFile.
// This lets us assert the exact argv array passed to docker — proving
// no shell interpolation happens — without spawning any real processes.
//
// `vi.hoisted` lets us mutate the mocked env across tests so we can cover
// both the DOCKER_REGISTRY-set and unset branches of expandImageName /
// pullArgs from a single mock factory.
// ==========================================

import { beforeEach, describe, expect, it, vi } from "vitest"

const { envState, execFileMock, loggerMock } = vi.hoisted(() => ({
  envState: { DOCKER_REGISTRY: "" as string | undefined },
  execFileMock: vi.fn(),
  loggerMock: { debug: vi.fn(), warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}))

vi.mock("node:child_process", () => ({
  execFile: execFileMock,
}))
vi.mock("node:util", () => ({
  promisify: <T>(fn: T): T => fn,
}))
vi.mock("../../src/env", () => ({ env: envState }))
vi.mock("@easyshell/logger", () => ({
  createLogger: () => loggerMock,
}))

const {
  dockerInspect,
  dockerKill,
  dockerPull,
  dockerRm,
  dockerRun,
  expandImageName,
  isSafeContainerName,
  isSafeImage,
  listExpiredSessions,
  pullArgs,
} = await import("../../src/docker/cli")

describe("docker CLI adapter", () => {
  beforeEach(() => {
    execFileMock.mockReset()
    loggerMock.debug.mockReset()
    loggerMock.warn.mockReset()
    loggerMock.info.mockReset()
    loggerMock.error.mockReset()
    envState.DOCKER_REGISTRY = ""
  })

  describe("expandImageName", () => {
    it("returns image as-is when no registry", () => {
      envState.DOCKER_REGISTRY = ""
      expect(expandImageName("easyshell-problems/foo-7")).toBe(
        "easyshell-problems/foo-7",
      )
    })

    it("returns image as-is when registry is undefined", () => {
      envState.DOCKER_REGISTRY = undefined
      expect(expandImageName("easyshell-problems/foo-7")).toBe(
        "easyshell-problems/foo-7",
      )
    })

    it("prefixes with the registry when registry is set", () => {
      envState.DOCKER_REGISTRY = "ghcr.io/myorg"
      expect(expandImageName("easyshell-problems/foo-7")).toBe(
        "ghcr.io/myorg/easyshell-problems/foo-7",
      )
    })
  })

  describe("pullArgs", () => {
    it("returns empty array when no registry", () => {
      envState.DOCKER_REGISTRY = ""
      expect(pullArgs()).toEqual([])
    })

    it("returns empty array when registry is undefined", () => {
      envState.DOCKER_REGISTRY = undefined
      expect(pullArgs()).toEqual([])
    })

    it("returns --pull=always when registry is set", () => {
      envState.DOCKER_REGISTRY = "ghcr.io/myorg"
      expect(pullArgs()).toEqual(["--pull=always"])
    })
  })

  describe("dockerKill", () => {
    it("calls docker container kill with argv array (no shell)", async () => {
      execFileMock.mockResolvedValue({ stdout: "", stderr: "" })

      const result = await dockerKill("test-container")

      expect(execFileMock).toHaveBeenCalledTimes(1)
      expect(execFileMock).toHaveBeenCalledWith("docker", [
        "container",
        "kill",
        "test-container",
      ])
      expect(result).toEqual({ ok: true })
    })

    it("returns ok:false with error message on failure", async () => {
      execFileMock.mockRejectedValue(
        new Error("No such container: missing-container"),
      )

      const result = await dockerKill("missing-container")

      expect(result.ok).toBe(false)
      expect(result.error).toContain("No such container")
    })
  })

  describe("dockerInspect", () => {
    it("returns running:true when container is running", async () => {
      execFileMock.mockResolvedValue({ stdout: "true\n", stderr: "" })

      const result = await dockerInspect("running-container")

      expect(execFileMock).toHaveBeenCalledWith("docker", [
        "inspect",
        "--format",
        "{{.State.Running}}",
        "running-container",
      ])
      expect(result).toEqual({ exists: true, running: true })
    })

    it("returns exists:true running:false when container is stopped", async () => {
      execFileMock.mockResolvedValue({ stdout: "false\n", stderr: "" })

      const result = await dockerInspect("stopped-container")

      expect(result).toEqual({ exists: true, running: false })
    })

    it("returns exists:false when container not found", async () => {
      execFileMock.mockRejectedValue(new Error("No such object: missing"))

      const result = await dockerInspect("missing")

      expect(result).toEqual({ exists: false, running: false })
    })

    it("throws, rather than reporting the container gone, when the engine fails", async () => {
      execFileMock.mockRejectedValue(
        Object.assign(new Error("exit 1"), {
          stderr:
            "Cannot connect to the Docker daemon at unix:///run/dind/docker.sock",
        }),
      )

      await expect(dockerInspect("easyshell-x")).rejects.toThrow(
        /Cannot connect to the Docker daemon/,
      )
    })
  })

  describe("dockerRm", () => {
    it("calls docker rm -f with argv array (no shell)", async () => {
      execFileMock.mockResolvedValue({ stdout: "", stderr: "" })

      await dockerRm("doomed-container")

      expect(execFileMock).toHaveBeenCalledWith("docker", [
        "rm",
        "-f",
        "doomed-container",
      ])
    })

    it("does not throw when container is already gone", async () => {
      execFileMock.mockRejectedValue(new Error("No such container"))

      await expect(dockerRm("ghost-container")).resolves.toBeUndefined()
    })
  })

  describe("dockerRun", () => {
    it("builds a session-mode argv with detach + bind mount (no shell)", async () => {
      execFileMock.mockResolvedValue({ stdout: "abc123\n", stderr: "" })

      const result = await dockerRun({
        containerName: "easyshell-session-x",
        image: "easyshell-problems/foo-7",
        mode: "session",
        detach: true,
        extraVolumes: [
          "/tmp/easyshell/sessions/easyshell-session-x:/tmp/easyshell",
        ],
      })

      expect(result).toEqual({ stdout: "abc123\n", stderr: "", exitCode: 0 })
      expect(execFileMock).toHaveBeenCalledTimes(1)

      const [bin, argv] = execFileMock.mock.calls[0] as [string, string[]]
      expect(bin).toBe("docker")
      expect(argv).toEqual([
        "run",
        "--rm",
        "--name",
        "easyshell-session-x",
        "--network",
        "none",
        "--pids-limit",
        "256",
        "--ulimit",
        "fsize=16777216",
        "--ulimit",
        "core=0",
        "-m",
        "64m",
        "--cpus",
        "0.1",
        "--label",
        "easyshell.mode=session",
        "-d",
        "-v",
        "/tmp/easyshell/sessions/easyshell-session-x:/tmp/easyshell",
        "easyshell-problems/foo-7",
        "-mode",
        "session",
      ])
    })

    it("builds a submission-mode argv with two volume mounts (no shell, no -d)", async () => {
      execFileMock.mockResolvedValue({ stdout: "", stderr: "" })

      await dockerRun({
        containerName: "easyshell-foo-7-submission-42-deadbeef",
        image: "easyshell-problems/foo-7",
        mode: "submission",
        extraVolumes: [
          "/tmp/easyshell/submissions/x/input.sh:/input.sh",
          "/tmp/easyshell/submissions/x/output.json:/output.json",
        ],
      })

      const [, argv] = execFileMock.mock.calls[0] as [string, string[]]
      expect(argv).not.toContain("-d")
      expect(argv).toContain("-v")
      expect(argv.filter((a) => a === "-v")).toHaveLength(2)
      expect(argv).toContain("/tmp/easyshell/submissions/x/input.sh:/input.sh")
      expect(argv).toContain(
        "/tmp/easyshell/submissions/x/output.json:/output.json",
      )
      expect(argv[argv.length - 2]).toBe("-mode")
      expect(argv[argv.length - 1]).toBe("submission")
    })

    it("inserts --pull=always and registry-prefixed image when DOCKER_REGISTRY is set", async () => {
      envState.DOCKER_REGISTRY = "ghcr.io/myorg"
      execFileMock.mockResolvedValue({ stdout: "", stderr: "" })

      await dockerRun({
        containerName: "easyshell-session-x",
        image: "easyshell-problems/foo-7",
        mode: "session",
        detach: true,
      })

      const [, argv] = execFileMock.mock.calls[0] as [string, string[]]
      expect(argv).toContain("--pull=always")
      expect(argv).toContain("ghcr.io/myorg/easyshell-problems/foo-7")
      expect(argv).not.toContain("easyshell-problems/foo-7")
    })

    it("returns non-zero exit code and captures stderr on docker failure", async () => {
      const err = Object.assign(new Error("Command failed"), {
        stdout: "",
        stderr: "Error response from daemon: pull access denied\n",
        code: 125,
      })
      execFileMock.mockRejectedValue(err)

      const result = await dockerRun({
        containerName: "fail",
        image: "missing-image",
        mode: "session",
      })

      expect(result.exitCode).toBe(125)
      expect(result.stderr).toContain("pull access denied")
      expect(loggerMock.warn).toHaveBeenCalledWith(
        expect.objectContaining({ exit_code: 125 }),
        "docker.run.failed",
      )
    })

    it("falls back to exit code 1 and error message when err has no code/stderr", async () => {
      execFileMock.mockRejectedValue(new Error("spawn ENOENT docker"))

      const result = await dockerRun({
        containerName: "no-docker",
        image: "img",
        mode: "session",
      })

      expect(result.exitCode).toBe(1)
      expect(result.stderr).toBe("spawn ENOENT docker")
    })

    it("honors custom memory and cpus overrides", async () => {
      execFileMock.mockResolvedValue({ stdout: "", stderr: "" })

      await dockerRun({
        containerName: "custom",
        image: "img",
        mode: "submission",
        memory: "256m",
        cpus: "0.5",
      })

      const [, argv] = execFileMock.mock.calls[0] as [string, string[]]
      const memIdx = argv.indexOf("-m")
      const cpuIdx = argv.indexOf("--cpus")
      expect(argv[memIdx + 1]).toBe("256m")
      expect(argv[cpuIdx + 1]).toBe("0.5")
    })

    it("flattens extraEnv entries with --env tokens", async () => {
      execFileMock.mockResolvedValue({ stdout: "", stderr: "" })

      await dockerRun({
        containerName: "envy",
        image: "img",
        mode: "submission",
        extraEnv: ["FOO=bar", "BAZ=qux"],
      })

      const [, argv] = execFileMock.mock.calls[0] as [string, string[]]
      expect(argv.filter((a) => a === "--env")).toHaveLength(2)
      expect(argv).toContain("FOO=bar")
      expect(argv).toContain("BAZ=qux")
    })
  })

  describe("sandbox hardening", () => {
    it("validates container names and image references", () => {
      for (const ok of ["easyshell-say-hello-1-session-42", "a", "x.y_z-1"])
        expect(isSafeContainerName(ok)).toBe(true)
      for (const bad of [
        "",
        "-rm",
        "x;id",
        "../etc",
        "a/b",
        "A",
        "x y",
        "a".repeat(129),
      ])
        expect(isSafeContainerName(bad)).toBe(false)
      for (const ok of [
        "easyshell-problems/foo-7",
        "cr.guneet.dev/easyshell-problems/foo-7",
        "localhost:5000/a/b@sha256:abc",
      ])
        expect(isSafeImage(ok)).toBe(true)
      for (const bad of ["", "--privileged", "x;id", "a/../b", "a b"])
        expect(isSafeImage(bad)).toBe(false)
    })

    it("refuses unsafe names without invoking docker", async () => {
      const result = await dockerRun({
        containerName: "x;id",
        image: "easyshell-problems/foo-7",
        mode: "session",
      })
      expect(result.exitCode).toBe(1)
      expect(await dockerKill("--all")).toEqual({
        ok: false,
        error: "invalid container name",
      })
      expect(await dockerInspect("a/../b")).toEqual({
        exists: false,
        running: false,
      })
      await dockerRm("$(id)")
      expect(execFileMock).not.toHaveBeenCalled()
    })

    it("adds labels and a timeout, and removes the container when it expires", async () => {
      const killed = Object.assign(new Error("killed"), {
        killed: true,
        signal: "SIGTERM",
      })
      execFileMock
        .mockRejectedValueOnce(killed)
        .mockResolvedValue({ stdout: "", stderr: "" })

      const result = await dockerRun({
        containerName: "easyshell-foo-7-submission-1",
        image: "easyshell-problems/foo-7",
        mode: "submission",
        labels: { "easyshell.session-expires": "123" },
        timeoutMs: 5000,
      })

      expect(result.exitCode).toBe(124)
      const [, argv, options] = execFileMock.mock.calls[0] as [
        string,
        string[],
        { timeout: number },
      ]
      expect(argv).toEqual(
        expect.arrayContaining(["--network", "none", "--pids-limit", "256"]),
      )
      expect(argv).toContain("easyshell.session-expires=123")
      expect(options.timeout).toBe(5000)
      expect(execFileMock).toHaveBeenLastCalledWith("docker", [
        "rm",
        "-f",
        "easyshell-foo-7-submission-1",
      ])
    })

    it("lists only expired, well-formed session containers", async () => {
      execFileMock.mockResolvedValue({
        stdout:
          "old-session 100\nfresh-session 9999999999\nno-label \nBAD;name 1\n",
        stderr: "",
      })
      expect(await listExpiredSessions(200_000)).toEqual(["old-session"])
      const [, argv] = execFileMock.mock.calls[0] as [string, string[]]
      expect(argv).toEqual(
        expect.arrayContaining(["--filter", "label=easyshell.mode=session"]),
      )
    })
  })

  describe("separate pull", () => {
    it("is a no-op without a registry", async () => {
      expect(await dockerPull("easyshell-problems/foo-7", 1000)).toEqual({
        ok: true,
      })
      expect(execFileMock).not.toHaveBeenCalled()
    })

    it("pulls the registry image, and runs with --pull=never when asked", async () => {
      envState.DOCKER_REGISTRY = "cr.example"
      execFileMock.mockResolvedValue({ stdout: "", stderr: "" })
      expect(await dockerPull("easyshell-problems/foo-7", 1000)).toEqual({
        ok: true,
      })
      expect(execFileMock).toHaveBeenCalledWith(
        "docker",
        ["pull", "--quiet", "cr.example/easyshell-problems/foo-7"],
        { timeout: 1000 },
      )
      await dockerRun({
        containerName: "easyshell-x",
        image: "easyshell-problems/foo-7",
        mode: "submission",
        pull: false,
      })
      const [, argv] = execFileMock.mock.calls[1] as [string, string[]]
      expect(argv).toContain("--pull=never")
      expect(argv).not.toContain("--pull=always")
    })

    it("reports a failed pull", async () => {
      envState.DOCKER_REGISTRY = "cr.example"
      execFileMock.mockRejectedValue(
        Object.assign(new Error("x"), { stderr: "manifest unknown" }),
      )
      expect(await dockerPull("easyshell-problems/foo-7", 1000)).toEqual({
        ok: false,
        error: "manifest unknown",
      })
    })
  })

  describe("user-caused run failures", () => {
    it("kills the CLI with SIGKILL on timeout", async () => {
      execFileMock.mockResolvedValue({ stdout: "", stderr: "" })
      await dockerRun({
        containerName: "easyshell-x",
        image: "easyshell-problems/foo-7",
        mode: "submission",
        timeoutMs: 1000,
      })
      const [, , options] = execFileMock.mock.calls[0] as [
        string,
        string[],
        { killSignal: string },
      ]
      expect(options.killSignal).toBe("SIGKILL")
    })

    it("reports oversized output and removes the container", async () => {
      execFileMock
        .mockRejectedValueOnce(
          Object.assign(new Error("maxBuffer"), {
            code: "ERR_CHILD_PROCESS_STDIO_MAXBUFFER",
          }),
        )
        .mockResolvedValue({ stdout: "", stderr: "" })
      const result = await dockerRun({
        containerName: "easyshell-x",
        image: "easyshell-problems/foo-7",
        mode: "submission",
      })
      expect(result).toMatchObject({ outputTooLarge: true })
      expect(execFileMock).toHaveBeenLastCalledWith("docker", [
        "rm",
        "-f",
        "easyshell-x",
      ])
    })
  })
})
