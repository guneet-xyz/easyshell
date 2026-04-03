"use client"

import { diffChars } from "diff"
import { useState } from "react"
import {
  PiAsterisk,
  PiCaretLeft,
  PiCaretRight,
  PiCheck,
  PiExclamationMark,
  PiQuestionMark,
  PiSidebar,
  PiSidebarDuotone,
} from "react-icons/pi"

import type { FsType } from "@easyshell/problems/schema"

import { Button } from "@/components/ui/button"
import { EasyTooltip } from "@/components/ui/tooltip"
import type { SetState } from "@/lib/client"
import { cn } from "@/lib/utils"

export function FsDiff({
  expected,
  actual,
}: {
  expected: FsType
  actual: FsType
}) {
  const files = Array.from(
    new Set([...Object.keys(expected), ...Object.keys(actual)]),
  ).sort()

  const [tab, setTab] = useState<"files" | "diff">("files")
  const [selectedFile, setSelectedFile] = useState<string | null>(null)

  if (tab === "files") {
    return (
      <Container
        setTab={setTab}
        tab={tab}
        files={files}
        selectedFile={selectedFile}
      >
        <div className="flex flex-col gap-1">
          {files.map((f) => (
            <File
              key={f}
              path={f}
              setTab={setTab}
              setSelectedFile={setSelectedFile}
              comment={evalComment(expected[f], actual[f])}
            />
          ))}
        </div>
      </Container>
    )
  }

  if (!selectedFile) {
    return (
      <Container
        setTab={setTab}
        tab={tab}
        files={files}
        selectedFile={selectedFile}
      >
        <div className="flex h-full flex-col items-center justify-center">
          <div className="text-lg font-semibold">
            Select a file to view diff
          </div>
        </div>
      </Container>
    )
  }

  const diff = diffChars(
    actual[selectedFile] ?? "",
    expected[selectedFile] ?? "",
  )

  const comment = evalComment(expected[selectedFile], actual[selectedFile])

  let heading: string
  switch (comment) {
    case "*":
      heading = "File content is different from expected"
      break
    case "?":
      heading = "File is not expected"
      break
    case "!":
      heading = "File is missing"
      break
    default:
      heading = "File is as expected"
      break
  }

  const nextFile =
    files.indexOf(selectedFile) === files.length - 1
      ? null
      : files[files.indexOf(selectedFile) + 1]

  const prevFile =
    files.indexOf(selectedFile) === 0
      ? null
      : files[files.indexOf(selectedFile) - 1]

  return (
    <Container
      setTab={setTab}
      tab={tab}
      files={files}
      selectedFile={selectedFile}
    >
      <div className="divide-y overflow-hidden rounded-md border">
        <div className="group flex items-center dark:bg-neutral-800">
          <EasyTooltip tip={prevFile ?? undefined}>
            <button
              className="flex h-7 w-8 cursor-pointer items-center justify-center disabled:cursor-not-allowed dark:bg-black dark:hover:bg-neutral-900"
              disabled={!prevFile}
              onClick={() => {
                if (prevFile) setSelectedFile(prevFile)
              }}
            >
              <PiCaretLeft />
            </button>
          </EasyTooltip>
          <FileComment comment={comment} />
          <div className="h-full border-l px-2 py-1 font-mono text-sm">
            {selectedFile}
          </div>
          <p className="ml-2 border-l border-neutral-200 px-4 text-sm dark:border-neutral-700 dark:text-neutral-300">
            {heading}
          </p>
          <EasyTooltip tip={nextFile ?? undefined}>
            <button
              className="ml-auto flex h-7 w-8 cursor-pointer items-center justify-center disabled:cursor-not-allowed dark:bg-black dark:hover:bg-neutral-900"
              disabled={!nextFile}
              onClick={() => {
                if (nextFile) setSelectedFile(nextFile)
              }}
            >
              <PiCaretRight />
            </button>
          </EasyTooltip>
        </div>
        <div className="overflow-x-auto p-4">
          <p className="font-geist-mono text-sm whitespace-pre">
            {diff.map((token, idx) => (
              <span
                key={idx}
                className={cn({
                  "bg-green-200 text-green-800 dark:bg-green-800 dark:text-green-200":
                    token.added,
                  "bg-red-200 text-red-800 dark:bg-red-800 dark:text-red-200":
                    token.removed,
                })}
              >
                {token.value}
              </span>
            ))}
          </p>
        </div>
      </div>
    </Container>
  )
}

function Container({
  children,
  setTab,
  tab,
  files,
  selectedFile,
}: {
  children: React.ReactNode
  setTab: SetState<"files" | "diff">
  tab: "files" | "diff"
  files: Array<string>
  selectedFile: string | null
}) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border p-8 shadow">
      <div className="text-center text-lg font-semibold">File System</div>
      <div className="p-1">
        <div className="mb-2 flex items-center gap-2">
          <Button
            variant="outline"
            className="relative h-10 w-10 border-neutral-300 bg-neutral-100 px-2 py-0 hover:bg-neutral-200 dark:border-neutral-700 dark:bg-black dark:hover:bg-neutral-900"
            onClick={() => setTab((t) => (t === "files" ? "diff" : "files"))}
          >
            <PiSidebar
              className={cn(
                "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 transition-opacity",
                {
                  "opacity-100": tab === "diff",
                  "opacity-0": tab === "files",
                },
                "text-2xl",
              )}
            />
            <PiSidebarDuotone
              className={cn(
                "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 transition-opacity",
                {
                  "opacity-0": tab === "diff",
                  "opacity-100": tab === "files",
                },
                "text-2xl",
              )}
            />
          </Button>
          <div className="flex h-10 grow items-center gap-2 rounded-md border border-neutral-300 bg-neutral-100 px-4 dark:border-neutral-700 dark:bg-black">
            <span>{files.length} files </span>
            {tab === "diff" && selectedFile ? (
              <span>
                <span>( viewing </span>
                <span className="font-geist-mono">
                  {files.indexOf(selectedFile) + 1}/{files.length}
                </span>
                <span> )</span>
              </span>
            ) : null}
          </div>
        </div>
        {children}
      </div>
    </div>
  )
}

function File({
  comment,
  path,
  setSelectedFile,
  setTab,
}: {
  path: string
  setSelectedFile: SetState<string | null>
  setTab: SetState<"files" | "diff">
  comment: "" | "*" | "?" | "!"
}) {
  return (
    <div
      className="group flex cursor-pointer items-center overflow-hidden rounded-md border"
      onClick={() => {
        setSelectedFile(path)
        setTab("diff")
      }}
    >
      <FileComment comment={comment} />
      <div className="h-full grow border-l px-2 py-1 font-mono text-sm group-hover:bg-neutral-100 dark:group-hover:bg-black">
        {path}
      </div>
    </div>
  )
}

function FileComment({ comment }: { comment: "" | "*" | "?" | "!" }) {
  if (comment === "*")
    return (
      <EasyTooltip tip="File content is different from expected">
        <div className="flex h-7 items-center justify-center bg-yellow-500/10 px-2">
          <PiAsterisk className="text-yellow-700 dark:text-yellow-300" />
        </div>
      </EasyTooltip>
    )
  if (comment === "?")
    return (
      <EasyTooltip tip="File is not expected">
        <div className="flex h-7 items-center justify-center bg-red-500/10 px-2">
          <PiQuestionMark className="text-red-700 dark:text-red-300" />
        </div>
      </EasyTooltip>
    )
  if (comment === "!")
    return (
      <EasyTooltip tip="File is missing">
        <div className="flex h-7 items-center justify-center bg-red-500/10 px-2">
          <PiExclamationMark className="text-red-700 dark:text-red-300" />
        </div>
      </EasyTooltip>
    )
  return (
    <EasyTooltip tip="File is as expected">
      <div className="flex h-7 items-center justify-center bg-green-500/10 px-2">
        <PiCheck className="text-green-700 dark:text-green-300" />
      </div>
    </EasyTooltip>
  )
}

function evalComment(
  expected?: string | null,
  actual?: string | null,
): "" | "*" | "?" | "!" {
  let comment: "" | "*" | "?" | "!" = ""
  if (expected !== undefined && expected !== null) {
    if (actual !== undefined && actual !== null) {
      if (expected !== actual) comment = "*"
    } else comment = "!"
  } else comment = "?"
  return comment
}
