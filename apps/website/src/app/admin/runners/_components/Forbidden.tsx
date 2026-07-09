import Link from "next/link"

export function Forbidden() {
  return (
    <div className="mx-auto max-w-md p-8 text-center">
      <h1 className="mb-4 text-2xl font-bold">Not authorized</h1>
      <p className="mb-6 text-sm text-gray-500">
        Your account does not have admin access.
      </p>
      <Link
        href="/"
        className="text-primary text-sm underline underline-offset-4"
      >
        Back to home
      </Link>
    </div>
  )
}
