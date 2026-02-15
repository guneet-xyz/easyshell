"use client"

import dynamic from "next/dynamic"
import { IoReturnDownBackSharp } from "react-icons/io5"

export const CommandKey = dynamic(
  () => import("./client").then((mod) => mod.CommandKey),
  { ssr: false },
)

export function ReturnKey() {
  return <IoReturnDownBackSharp />
}
