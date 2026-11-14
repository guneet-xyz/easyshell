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
    slug: "shell-basics",
    name: "Shell Basics",
    description:
      "Before you wrangle logs and bully APIs, learn to speak fluent shell: where output goes, how variables behave, and how to make decisions.",
    image: "",
    sections: [
      {
        title: "Talking Back",
        description:
          "Your commands have a lot to say. Point it at a file with `>` and `>>`, and learn which of the two is a paper shredder.",
        problems: ["dear-diary", "dont-overwrite-grandma"],
      },
      {
        title: "Two Streams",
        description:
          "Every program talks through two mouths: standard output for the good stuff, standard error for the complaining. Send each one where it belongs.",
        problems: ["shhh-errors", "two-buckets"],
      },
      {
        title: "Command Chaining",
        description:
          "`&&`, `||` and `;`: run the next thing only when it makes sense, and always have a backup plan (it's usually takeout).",
        problems: ["coffee-or-takeout"],
      },
      {
        title: "Variables & Quoting",
        description:
          "Load variables from files, survive filenames full of spaces, and stop the shell from eating your dollar signs.",
        problems: ["mission-briefing", "spaces-are-evil", "literally-dollars"],
      },
      {
        title: "Decisions & Loops",
        description:
          "Exit codes, `if`, `case` and `for`: teach your scripts to make choices, and to do the boring stuff thirty times so you don't have to.",
        problems: ["exit-stage-left", "traffic-light", "thirty-days-of-files"],
      },
    ],
  },
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
      {
        title: "Copying & Organizing",
        description:
          "Back things up before you wreck them, sort the chaos, and flatten the nesting. Your boss is watching, and this time he's taking notes.",
        problems: [
          "backup-before-you-wreck",
          "sort-by-extension",
          "flatten-the-folders",
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
  {
    slug: "text-surgery",
    name: "Text Surgery",
    description:
      "Scalpels out. Slice, stitch, sort and count text with the classic Unix tools: `tr`, `cut`, `sort`, `uniq`, `sed`, `awk`, `rev` and `tac`.",
    image: "",
    sections: [
      {
        title: "Slicing & Dicing",
        description:
          "Pick out exactly the characters, lines and columns you need, and leave the rest on the cutting board.",
        problems: [
          "shout-it-out",
          "line-forty-two",
          "crew-manifest",
          "backwards-day",
        ],
      },
      {
        title: "Sorting Things Out",
        description:
          "`sort` and `uniq`, the dynamic duo. One lines everything up, the other knocks out the copies.",
        problems: ["one-of-each", "top-of-the-pops", "word-up"],
      },
      {
        title: "Search & Replace",
        description:
          "`sed` and friends: edit text without ever opening an editor. Your mouse will feel left out.",
        problems: ["redact-the-ex", "between-the-lines", "does-it-spark-joy"],
      },
      {
        title: "Number Crunching",
        description:
          "`awk` does the maths so you don't have to. It can't do your taxes. Yet.",
        problems: ["penny-pincher"],
      },
    ],
  },
]
