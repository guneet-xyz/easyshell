import { Footer } from "@/components/footer"

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full flex-col items-center gap-8">
      <div
        className="w-full bg-gray-50 p-10 lg:p-10 dark:bg-emerald-950"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='4' height='4' viewBox='0 0 4 4'%3E%3Cpath fill='%239C92AC' fill-opacity='0.4' d='M1 3h1v1H1V3zm2-2h1v1H3V1z'%3E%3C/path%3E%3C/svg%3E")`,
        }}
      >
        <h1 className="text-center font-clash-display text-3xl font-bold lg:text-6xl dark:text-emerald-100">
          Browse Problems
        </h1>
      </div>
      <div className="mb-auto w-[85%] min-w-80">{children}</div>
      <Footer />
    </div>
  )
}
