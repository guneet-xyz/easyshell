import createMDX from "@next/mdx"

if (!process.env.NEXT_PUBLIC_POSTHOG_KEY)
  throw "NEXT_PUBLIC_POSTHOG_KEY is not defined"

if (!process.env.POSTHOG_HOST) throw "POSTHOG_HOST is not defined"

/** @type {import('next').NextConfig} */
const config = {
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
        destination: `https://${process.env.POSTHOG_HOST}/static/:path*`,
      },
      {
        source: "/ph/:path*",
        destination: `https://${process.env.POSTHOG_HOST}/:path*`,
      },
    ]
  },
  skipTrailingSlashRedirect: true,
}

const withMDX = createMDX({})

export default withMDX(config)
