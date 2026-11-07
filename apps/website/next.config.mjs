import createMDX from "@next/mdx"

// PostHog is optional: without POSTHOG_HOST the /ph proxy rewrites are omitted.
const posthogHost = process.env.POSTHOG_HOST

/** @type {import('next').NextConfig} */
const config = {
  pageExtensions: ["js", "jsx", "md", "mdx", "ts", "tsx"],
  reactStrictMode: false,
  experimental: {
    mdxRs: true,
  },
  output: "standalone",
  async rewrites() {
    if (!posthogHost) return []
    return [
      {
        source: "/ph/static/:path*",
        destination: `https://${posthogHost}/static/:path*`,
      },
      {
        source: "/ph/:path*",
        destination: `https://${posthogHost}/:path*`,
      },
    ]
  },
  skipTrailingSlashRedirect: true,
  allowedDevOrigins: ["daedalus"],
}

const withMDX = createMDX({})

export default withMDX(config)
