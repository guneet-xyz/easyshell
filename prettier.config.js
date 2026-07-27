/** @type {import('prettier').Config & import('prettier-plugin-tailwindcss').PluginOptions & import('@ianvs/prettier-plugin-sort-imports').PrettierConfig } **/
const config = {
  plugins: [
    "@ianvs/prettier-plugin-sort-imports",
    "prettier-plugin-packagejson",
    "prettier-plugin-tailwindcss",
  ],
  semi: false,
  importOrder: [
    "^@easyshell",
    "",
    "^@/",
    "",
    "^[.]",
    "",
    "<THIRD_PARTY_MODULES>",
    "",
    "<BUILTIN_MODULES>",
  ],
  importOrderCaseSensitive: true,
  importOrderTypeScriptVersion: "5.0.0",
  tailwindStylesheet: "./apps/website/src/styles/globals.css",
}

export default config
