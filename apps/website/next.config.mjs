import createMDX from "@next/mdx"
import path from "path"

/** @type {import('next').NextConfig} */
const config = {
  pageExtensions: ["js", "jsx", "md", "mdx", "ts", "tsx"],
  reactStrictMode: false,
  experimental: {
    mdxRs: true,
    outputFileTracingRoot: path.join(import.meta.dirname, "../../"),
  },
  output: "standalone",
}

const withMDX = createMDX({})

export default withMDX(config)
