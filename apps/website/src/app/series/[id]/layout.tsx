import { Back } from "@/components/back"
import { Footer } from "@/components/footer"

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="mx-auto w-[95%] pt-20 md:w-[90%] lg:w-2/3">
        <Back href="/browse" />
        {children}
      </div>
      <Footer className="mt-20" />
    </>
  )
}
