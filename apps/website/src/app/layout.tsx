import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import "@/styles/globals.css"

import { Navbar } from "./_components/navbar"
import { SessionProvider } from "./_components/session-provider"
import { ClientSideProviders } from "./client-side-providers"

import { GeistMono } from "geist/font/mono"
import { GeistSans } from "geist/font/sans"
import { type Metadata } from "next"
import { ThemeProvider } from "next-themes"

export const metadata: Metadata = {
  title: "easyshell - practice your shell",
  description: "Level up your terminal skills!",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${GeistSans.variable} ${GeistMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <link
          href="https://api.fontshare.com/v2/css?f[]=clash-display@1&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-geist flex h-screen flex-col dark:bg-neutral-900">
        <ClientSideProviders>
          <ThemeProvider attribute="class" defaultTheme="dark">
            <SessionProvider>
              <Toaster />
              <TooltipProvider>
                <Navbar />
                <div className="grow">{children}</div>
              </TooltipProvider>
            </SessionProvider>
          </ThemeProvider>
        </ClientSideProviders>
      </body>
    </html>
  )
}
