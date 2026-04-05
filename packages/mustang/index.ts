// @easyshell/mustang — shared library for interacting with the mustang service.
export {
  createMustangClient,
  type MustangClient,
  type CreateSessionRequest,
  type CreateSessionResponse,
  type SessionReadyResponse,
  type ExecSessionResponse,
  type CheckSessionResponse,
  type CreateSubmissionRequest,
  type CreateSubmissionResponse,
  type StandardOutput,
  type ScoreResult,
  type PollSubmissionResponse,
  type ExecResult,
  type ExecError,
} from "./client"

export {
  runTerminalSession,
  getTerminalSession,
  createTerminalSession,
  getActiveTerminalSession,
  killTerminalSessions,
  submitCommand,
  checkSession,
  insertTerminalSession,
  getTerminalSessionLogs,
  insertTerminalSessionLog,
  type TerminalSessionLog,
} from "./sessions"

export { runSubmissionAndGetOutput } from "./submissions"
