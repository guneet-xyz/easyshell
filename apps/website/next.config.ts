import createMDX from "@next/mdx"
import type { NextConfig } from "next"

import { env } from "@/env"

const config: NextConfig = {
  pageExtensions: ["js", "jsx", "md", "mdx", "ts", "tsx"],
  reactStrictMode: false,
  experimental: {
    mdxRs: true,
  },
  output: "standalone",
  async rewrites() {
    return [
      {
        source: "/ph/static/:path*",
        destination: `https://${env.POSTHOG_HOST}/static/:path*`,
      },
      {
        source: "/ph/:path*",
        destination: `https://${env.POSTHOG_HOST}/:path*`,
      },
    ]
  },
  skipTrailingSlashRedirect: true,
}

const withMDX = createMDX({})

export default withMDX(config)
