import createMDX from "@next/mdx"

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
        destination: "https://posthog.guneet.xyz/static/:path*",
      },
      {
        source: "/ph/:path*",
        destination: "https://posthog.guneet.xyz/:path*",
      },
    ]
  },
  skipTrailingSlashRedirect: true,
}

const withMDX = createMDX({})

export default withMDX(config)
