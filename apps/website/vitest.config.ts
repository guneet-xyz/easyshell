import path from "node:path"
import { defineConfig } from "vitest/config"

// `import.meta.dirname` is available on Node 20.11+, which this repo targets
// (see README "Pre-Requisites": Node v22.14.0). Using it avoids the CJS-only
// `__dirname` global, which is `undefined` in this ESM package.
export default defineConfig({
  test: {
    environment: "node",
    include: ["test/**/*.spec.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
})
