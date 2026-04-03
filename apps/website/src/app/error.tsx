"use client"

export default function ErrorPage() {
  return (
    <div className="flex h-full flex-col items-center justify-center">
      <div className="text-center font-clash-display text-6xl font-bold md:text-8xl">
        Oopsies
      </div>
      <div className="mt-2 text-center text-neutral-600 md:text-2xl">
        {`Something went wrong.`}
      </div>
      <div className="mt-2 text-center text-sm text-neutral-400">
        {`Report this issue on GitHub.`}
      </div>
    </div>
  )
}
