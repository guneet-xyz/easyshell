import js from "@eslint/js"
import nextVitals from "eslint-config-next/core-web-vitals"
import nextTs from "eslint-config-next/typescript"
import drizzle from "eslint-plugin-drizzle"
import { defineConfig, globalIgnores } from "eslint/config"
import globals from "globals"
import tseslint from "typescript-eslint"

const ignores = [
  "**/node_modules/**",
  "**/.next/**",
  "**/.open-next/**",
  "**/.vercel/**",
  "**/out/**",
  "**/build/**",
  "**/coverage/**",
  ".omo/**",
  "data/**",
  "tsconfig.tsbuildinfo",
  "apps/website/next-env.d.ts",
  "packages/data/**/generated.js",
  "packages/data/**/generated.config.js",
  "apps/submission-manager/submission-manager.cjs",
]

export default defineConfig([
  globalIgnores(ignores),
  {
    files: ["**/*.{js,mjs,cjs}"],
    ignores: ["apps/website/**"],
    ...js.configs.recommended,
    languageOptions: {
      ...js.configs.recommended.languageOptions,
      ecmaVersion: "latest",
      globals: globals.node,
      sourceType: "module",
    },
    rules: {
      ...js.configs.recommended.rules,
      "prefer-const": "warn",
    },
  },
  {
    files: ["**/*.cjs"],
    ignores: ["apps/website/**"],
    languageOptions: {
      globals: globals.node,
      sourceType: "commonjs",
    },
  },
  {
    files: ["**/*.{ts,tsx}"],
    ignores: ["apps/website/**"],
    extends: [...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: "latest",
      globals: globals.node,
      sourceType: "module",
    },
    rules: {
      "@typescript-eslint/no-empty-object-type": "off",
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": ["warn", { caughtErrors: "none" }],
      "prefer-const": "warn",
    },
  },
  {
    files: ["apps/website/**/*.{js,jsx,ts,tsx}"],
    extends: [...nextVitals, ...nextTs],
    plugins: { drizzle },
    settings: {
      next: {
        rootDir: "apps/website/",
      },
    },
    rules: {
      "@typescript-eslint/no-empty-object-type": "off",
      "@typescript-eslint/no-unused-vars": ["warn", { caughtErrors: "none" }],
    },
  },
])
