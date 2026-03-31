import { Footer } from "@/components/footer"

import Link from "next/link"
import { BiCustomize } from "react-icons/bi"
import { IoSpeedometerOutline } from "react-icons/io5"
import { PiTarget } from "react-icons/pi"
import { SiGnometerminal } from "react-icons/si"
import { TbChevronsDown } from "react-icons/tb"

export default function HomePage() {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center">
      <div className="px-4 pt-28 text-center">
        <span className="font-clash-display text-3xl font-medium sm:text-4xl lg:text-5xl xl:text-6xl">
          {`Using the terminal should be `}
        </span>
        <span className="font-clash-display text-3xl font-semibold italic underline underline-offset-8 sm:text-4xl lg:text-5xl xl:text-6xl">
          easy
        </span>
        <span className="font-clash-display text-3xl font-medium sm:text-4xl lg:text-5xl xl:text-6xl">
          .
        </span>
      </div>
      <div className="font-clash-display mt-2 px-4 text-center text-base sm:mt-4 sm:text-xl lg:mt-8 lg:text-2xl">
        Level up your terminal skills with our interactive shell challenges.
      </div>
      <div className="mt-16 flex items-center justify-center gap-8">
        <Link
          href="#disclaimer"
          className="mt-4 flex items-center gap-2 rounded-md border-b-4 border-neutral-500 bg-neutral-100 p-2 transition-colors hover:bg-neutral-200/80 dark:border-neutral-400 dark:bg-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-600/80"
        >
          <TbChevronsDown />
          <div className="font-clash-display font-medium">Disclaimer</div>
          <TbChevronsDown />
        </Link>
        <Link
          href="/browse"
          className="group mt-4 flex items-center gap-1 rounded-md border-b-4 border-neutral-500 bg-neutral-800 px-4 py-2 text-white transition-colors hover:bg-neutral-800/90 dark:border-neutral-600 dark:bg-neutral-100 dark:text-neutral-800 dark:hover:bg-neutral-200"
        >
          <div className="font-clash-display font-medium">Get Started</div>
          <PiTarget className="text-xl" />
        </Link>
      </div>
      <div className="mt-auto flex flex-wrap justify-around gap-8 px-8 py-16">
        <Card
          image={
            <SiGnometerminal className="size-[60%] text-neutral-800 dark:text-neutral-200" />
          }
          title="Live Terminal"
          description="Practice your skills on a terminal without leaving your browser."
        />
        <Card
          image={
            <IoSpeedometerOutline className="size-2/3 text-neutral-800 dark:text-neutral-200" />
          }
          title="Varying Difficulty"
          description="Choose from a range of challenges, from beginner to advanced."
        />
        <Card
          image={
            <BiCustomize className="size-2/3 text-neutral-800 dark:text-neutral-200" />
          }
          title="Customizable"
          description="Customize your experience with themes, fonts, and more."
        />
      </div>
      <div className="font-clash-display mb-16 text-3xl">
        more features to come ...
      </div>
      <div
        className="mt-auto w-full bg-neutral-100/70 px-8 py-16 dark:bg-neutral-800/60"
        id="disclaimer"
      >
        <div className="mx-auto w-fit">
          <div className="font-clash-display text-2xl font-bold">
            DISCLAIMER
          </div>
          <div className="font-clash-display text-neutral-700 dark:text-neutral-300">
            {"This project is under "}
            <Link
              href="https://github.com/kvqn/easyshell"
              className="underline underline-offset-4"
              target="_blank"
            >
              active development.
            </Link>
            {` Anything you see here is subject to change. If you encounter any bugs or have any suggestions, `}
            <Link
              href="https://x.com/kvqn_dev"
              className="underline underline-offset-4"
              target="_blank"
            >
              contact me
            </Link>
            {`.`}
          </div>
        </div>
      </div>
      <Footer />
    </div>
  )
}

function Card({
  image,
  title,
  description,
}: {
  image?: React.ReactNode
  title: string
  description: string
}) {
  return (
    <div className="max-w-80 rounded-xl border bg-neutral-50 p-4 shadow md:max-w-60 xl:max-w-80 dark:bg-neutral-950/50">
      <div className="font-clash-display flex aspect-square items-center justify-center rounded-md bg-neutral-200 dark:bg-neutral-800/30">
        {image ?? "<insert_image>"}
      </div>
      <div className="mt-4 text-sm font-medium md:text-base">{title}</div>
      <div className="mt-1 text-sm text-neutral-500 md:text-base">
        {description}
      </div>
    </div>
  )
}
