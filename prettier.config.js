/** @type {import('prettier').Config & import('prettier-plugin-tailwindcss').PluginOptions & import('@ianvs/prettier-plugin-sort-imports').PluginConfig}*/
const config = {
  plugins: [
    "@ianvs/prettier-plugin-sort-imports",
    "prettier-plugin-packagejson",
    "prettier-plugin-tailwindcss",
  ],
  semi: false,
  importOrder: [
    "<THIRD_PARTY_MODULES>",
    "",
    "^@easyshell(.*)$",
    "",
    "^@/(.*)$",
    "",
    "^[./]",
  ],
  importOrderTypeScriptVersion: "5.7.3",
  tailwindStylesheet: "./apps/website/src/styles/globals.css",
}

export default config
