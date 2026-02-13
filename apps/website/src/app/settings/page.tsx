import { ClientOnly } from "@/components/client-only"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { auth } from "@/lib/server/auth"
import { getUserProviders } from "@/lib/server/queries"
import { getPathname } from "@/lib/server/utils"

import { SettingsNameImage } from "./_components/name-image"
import {
  PromptSettings,
  PromptSettingsContextProvider,
} from "./_components/prompt-settings"
import {
  DiscordCard,
  GithubCard,
  GoogleCard,
} from "./_components/provider-cards"
import { ThemeToggle } from "./_components/theme-toggle"

import { redirect } from "next/navigation"

export const metadata = {
  title: "easyshell - account settings",
}

export default async function Page() {
  const user = (await auth())?.user
  if (!user) {
    const pathname = await getPathname()
    redirect(`/login?callback=${pathname}`)
  }

  const providers = await getUserProviders(user.id)

  return (
    <div className="min-h-screen p-6">
      <div className="mx-auto max-w-4xl space-y-6">
        <SettingsNameImage
          image={user.image}
          username={user.username}
          name={user.name}
        />
        <Card>
          <CardHeader>
            <h2 className="text-xl font-bold">Preferences</h2>
            <p className="text-sm text-gray-500">
              Configure these settings to customize your experience on
              easyshell.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Dark Mode
                </p>
                <p className="text-sm text-gray-500">Toggle dark theme.</p>
              </div>
              <ThemeToggle />
            </div>
            <ClientOnly>
              <PromptSettingsContextProvider>
                <PromptSettings />
              </PromptSettingsContextProvider>
            </ClientOnly>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-xl font-bold">Integrations</h2>
            <p className="text-sm text-gray-500">Connect your accounts.</p>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center justify-center gap-4 pb-8 lg:gap-8">
            <DiscordCard connected={providers.discord} />
            <GithubCard connected={providers.github} />
            <GoogleCard connected={providers.google} />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
