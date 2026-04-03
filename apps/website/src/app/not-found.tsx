export const metadata = {
  title: "easyshell - not found",
}

export default function Page() {
  return (
    <div className="flex h-full flex-col items-center justify-center">
      <div className="text-center font-clash-display text-6xl font-bold md:text-8xl">
        Not Found
      </div>
      <div className="mt-2 text-center text-neutral-600 md:text-2xl">
        {`What you're looking for doesn't exist.`}
      </div>
      <div className="mt-2 text-center text-sm text-neutral-400">
        {`Check the URL or go back to the previous page.`}
      </div>
    </div>
  )
}
