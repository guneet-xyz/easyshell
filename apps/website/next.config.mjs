import createMDX from "@next/mdx"

/** @type {import('next').NextConfig} */
const config = {
  pageExtensions: ["js", "jsx", "md", "mdx", "ts", "tsx"],
  reactStrictMode: false,
  experimental: {
    mdxRs: true,
  },
  output: "standalone",
  // outputFileTracingRoot: import.meta.dirname,
}

const withMDX = createMDX({})

// @ts-ignore
export default withMDX(config)
