"use client"

import { PiMoon, PiMoonDuotone, PiSun, PiSunDuotone } from "react-icons/pi"

import { Button } from "@/components/ui/button"
import { useTheme } from "@/lib/client"

export function ThemeToggle({ text = false }: { text?: boolean }) {
  const { theme, setTheme } = useTheme()
  return (
    <Button
      variant="outline"
      className="group w-fit space-x-4"
      onClick={() => {
        if (theme === "light") setTheme("dark")
        else setTheme("light")
      }}
    >
      <div className="relative size-4">
        {theme === "light" ? (
          <>
            <PiSun className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-3xl transition-opacity group-hover:opacity-0" />
            <PiSunDuotone className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-3xl opacity-0 transition-opacity group-hover:opacity-100" />
          </>
        ) : (
          <>
            <PiMoon className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-3xl transition-opacity group-hover:opacity-0" />
            <PiMoonDuotone className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-3xl opacity-0 transition-opacity group-hover:opacity-100" />
          </>
        )}
      </div>
      {text ? (
        <div>{theme === "light" ? "Light Mode" : "Dark Mode"}</div>
      ) : null}
    </Button>
  )
}
