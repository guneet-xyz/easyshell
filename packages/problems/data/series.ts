export const SeriesList: Array<{
  slug: string
  name: string
  image: string
  description: string
  sections: Array<{
    title: string
    description: string
    problems: Array<string>
  }>
}> = [
  {
    slug: "file-management",
    name: "File Management",
    description: "Manage your files without leaving the terminal.",
    image: "",
    sections: [
      {
        title: "Locating Files",
        description: "When locating files, `find` is your best friend.",
        problems: ["find-that-file"],
      },
      {
        title: "Moving And Renaming",
        description:
          "From the perspective of your computer, these are the same thing. Try out the following problems to get a feel for how to move and rename files.",
        problems: ["move-that-file", "move-and-rename", "bulk-move"],
      },

      {
        title: "Removing Files",
        description:
          "Removing files is a dangerous operation. Make sure you know what you're doing before you do it.",
        problems: [
          "rm-that-file",
          "wipe-that-folder",
          "nuke-all-matches",
          "mdx-no-more",
        ],
      },
    ],
  },
  {
    slug: "parsing",
    description: "Turn raw data into something useful.",
    name: "Parsing",
    image: "",
    sections: [
      {
        title: "Parsing JSON",
        description:
          "Many tools and network requests respond using JSON. Learn how to take some JSON output and turn it into something useful.",
        problems: [
          "filter-logs",
          "combine-json",
          "get-it-curl",
          "post-it",
          "post-with-token",
        ],
      },
      {
        title: "Regular Expressions with GREP",
        description:
          "When you don't have a JSON output, you have to parse it yourself. There are many tools for this and `grep` is one of them.",
        problems: [
          "grep-mail",
          "grep-version",
          "grep-version-2",
          "mdx-no-more",
        ],
      },
    ],
  },
]
