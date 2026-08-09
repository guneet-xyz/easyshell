import Link from "next/link"
import { AiTwotoneQuestionCircle } from "react-icons/ai"

export function ProblemNotFound() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2">
      <div className="fixed -z-10 font-mono text-8xl font-black">
        {Array.from({ length: 10 }).map((_, i) => (
          <>
            <div key={2 * i} className="flex gap-2 bg-gray-50 text-white">
              {Array.from({ length: 10 }).map((_, j) => (
                <p className="" key={j}>
                  4040
                </p>
              ))}
            </div>
            <div key={2 * i + 1} className="flex gap-2 bg-white text-gray-50">
              {Array.from({ length: 10 }).map((_, j) => (
                <p className="" key={j}>
                  0404
                </p>
              ))}
            </div>
          </>
        ))}
      </div>
      <h2 className="text-xl">
        {`I don't think a problem like that exists here`}
      </h2>
      <Link
        prefetch={true}
        href="/browse"
        className="transition-transform hover:scale-105"
        aria-label="Go back to browse problems"
      >
        <AiTwotoneQuestionCircle className="animate-spin cursor-pointer text-[10rem]" />
      </Link>
      <h2 className="text-xl">
        Click the giant spinning question mark to go back.
      </h2>
    </div>
  )
}
