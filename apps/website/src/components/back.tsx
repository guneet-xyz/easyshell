import Link from "next/link"
import { IoIosArrowBack } from "react-icons/io"

export function Back({ href }: { href: string }) {
  return (
    <Link
      href={href}
      className="group flex w-fit items-center gap-1 rounded-md border border-neutral-300 bg-neutral-50 pl-2 text-neutral-500 shadow-xs transition-colors hover:bg-neutral-100 hover:text-neutral-600 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-500 dark:hover:bg-neutral-900 dark:hover:text-neutral-400"
      prefetch={true}
    >
      <IoIosArrowBack className="m-0 h-4 w-4 p-0 transition-transform group-hover:-translate-x-0.5" />
      <p className="mr-4">Back</p>
    </Link>
  )
}
