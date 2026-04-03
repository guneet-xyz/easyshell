import { PiCommand, PiControl } from "react-icons/pi"

import { clientOS } from "@/lib/client"

export function CommandKey() {
  const os = clientOS()
  return os === "mac" ? <PiCommand /> : <PiControl />
}
