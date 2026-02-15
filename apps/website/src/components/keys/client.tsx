import { clientOS } from "@/lib/client"

import { PiCommand, PiControl } from "react-icons/pi"

export function CommandKey() {
  const os = clientOS()
  return os === "mac" ? <PiCommand /> : <PiControl />
}
