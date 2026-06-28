import { build } from "esbuild"

await build({
  entryPoints: ["src/index.ts"],
  bundle: true,
  platform: "node",
  outfile: "coordinator.cjs",
  format: "cjs",
  // pino-pretty uses worker threads and dynamic requires that can't be bundled
  // better-sqlite3 is not used by coordinator but guard it anyway
  external: ["pino-pretty", "better-sqlite3"],
})
