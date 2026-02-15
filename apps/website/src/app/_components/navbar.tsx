import { DesktopContainer, MobileContainer } from "@/components/media"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerTrigger,
} from "@/components/ui/drawer"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { auth } from "@/lib/server/auth"

import { ThemeToggle } from "./theme-toggle"

import { HamburgerMenuIcon } from "@radix-ui/react-icons"
import Link from "next/link"
import { ReactNode } from "react"
import { PiGear, PiGearDuotone } from "react-icons/pi"

function Logo() {
  return (
    <Link className="text-2xl" href="/" prefetch={true}>
      <div className="relative flex">
        <span className="font-bold">easy</span>
        <span className="font-bold text-green-500">shell</span>
        <div className="absolute top-1/2 right-0 translate-y-1/2 font-clash-display text-xs font-semibold text-neutral-500/70">
          PREVIEW
        </div>
      </div>
    </Link>
  )
}

export function Navbar() {
  return (
    <div className="flex items-center gap-8 bg-transparent px-4 py-2">
      <Logo />
      <Link
        href="/problems"
        className="mt-1 hidden text-neutral-500 transition-colors hover:text-black md:block dark:hover:text-white"
        prefetch={true}
      >
        Problems
      </Link>
      <Link
        href="/wiki"
        className="mt-1 hidden text-neutral-500 transition-colors hover:text-black md:block dark:hover:text-white"
        prefetch={true}
      >
        Wiki
      </Link>
      <div className="ml-auto">
        <DesktopContainer>
          <Options />
        </DesktopContainer>
        <MobileContainer>
          <NavigationDrawer />
        </MobileContainer>
      </div>
    </div>
  )
}

function Options() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className="p-2" aria-label="Options">
          <HamburgerMenuIcon width="1.5rem" height="1.5rem" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full">
        <div className="flex w-full flex-col gap-2">
          <div className="flex justify-between gap-2 *:grow">
            <Link href="/settings" prefetch={true}>
              <Button
                variant="outline"
                className="group flex w-full items-center justify-center"
                aria-label="Settings"
              >
                <div className="relative size-4">
                  <PiGear className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-3xl transition-opacity group-hover:opacity-0" />
                  <PiGearDuotone className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-3xl opacity-0 transition-opacity group-hover:opacity-100" />
                </div>
              </Button>
            </Link>
            <ThemeToggle />
          </div>
          <User />
        </div>
      </PopoverContent>
    </Popover>
  )
}

function LinkWrapper({
  drawer,
  children,
}: {
  drawer?: boolean
  children: ReactNode
}) {
  if (drawer) return <DrawerClose asChild>{children}</DrawerClose>
  return <>{children}</>
}

async function User({ drawer }: { drawer?: boolean }) {
  const user = (await auth())?.user
  if (user)
    return (
      <div className="flex w-full flex-col">
        <LinkWrapper drawer={drawer}>
          <Link href={`/profile/${user.username}`} prefetch={true}>
            <Button
              variant="outline"
              className="flex w-full gap-1 rounded-md border px-2 py-2"
              aria-label="User Profile"
            >
              <Avatar className="mr-1.5 h-6 w-6">
                <AvatarImage src={user.image ?? ""} />
                <AvatarFallback>{user.username[0]}</AvatarFallback>
              </Avatar>
              <p>{user.username}</p>
            </Button>
          </Link>
        </LinkWrapper>
        <LinkWrapper drawer={drawer}>
          <Link href="/logout" className="mt-2 w-full" prefetch={true}>
            <Button
              variant="destructive"
              className="w-full"
              aria-label="Logout"
            >
              Logout
            </Button>
          </Link>
        </LinkWrapper>
      </div>
    )

  return (
    <div className="flex w-full flex-col">
      <p className="rounded-md border px-4 py-2 text-neutral-500">
        Not logged in
      </p>
      <Link href="/login" className="mt-2 w-full" prefetch={true}>
        <Button className="w-full" aria-label="Login">
          Login
        </Button>
      </Link>
    </div>
  )
}

function NavigationDrawer() {
  return (
    <Drawer>
      <DrawerTrigger asChild>
        <Button variant="outline" className="p-2" aria-label="Options">
          <HamburgerMenuIcon width="1.5rem" height="1.5rem" />
        </Button>
      </DrawerTrigger>
      <DrawerContent>
        <NavigationMenu />
      </DrawerContent>
    </Drawer>
  )
}

function NavigationMenuItem({ name, href }: { name: string; href: string }) {
  return (
    <DrawerClose asChild>
      <Link
        href={href}
        className="group flex items-center justify-between rounded-md border px-4 py-2 transition-colors hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
        prefetch={true}
      >
        <div className="text-neutral-700 transition-colors group-hover:text-black dark:text-neutral-300 dark:group-hover:text-white">
          {name}
        </div>
        <div className="text-sm text-neutral-400 group-hover:text-neutral-500 dark:text-neutral-700">
          {href}
        </div>
      </Link>
    </DrawerClose>
  )
}

function NavigationMenu() {
  return (
    <div className="mx-auto w-[90%] pt-4 pb-8">
      <div className="mb-4 text-center font-clash-display text-xl font-medium">
        About You
      </div>
      <div className="flex w-full flex-col gap-2">
        <div className="flex justify-between gap-2 *:grow">
          <DrawerClose asChild>
            <Link href="/settings" prefetch={true}>
              <Button
                variant="outline"
                className="group flex w-full items-center justify-center gap-4"
                aria-label="Settings"
              >
                <div className="relative size-4">
                  <PiGear className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-3xl transition-opacity group-hover:opacity-0" />
                  <PiGearDuotone className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-3xl opacity-0 transition-opacity group-hover:opacity-100" />
                </div>
                <div>Settings</div>
              </Button>
            </Link>
          </DrawerClose>
          <ThemeToggle text />
        </div>
        <User drawer />
      </div>
      <div className="my-4 text-center font-clash-display text-xl font-medium">
        Navigation Menu
      </div>
      <div className="flex w-full flex-col gap-2">
        <NavigationMenuItem name="Problems" href="/problems" />
        <NavigationMenuItem name="Wiki" href="/wiki" />
      </div>
    </div>
  )
}
