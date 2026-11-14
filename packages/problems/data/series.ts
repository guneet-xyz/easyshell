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
  {
    slug: "data-wrangling",
    name: "Data Wrangling",
    description:
      "The sequel to Parsing. Group, reshape, join and convert JSON, CSV, .env and INI files until your boss finally stops asking for it as a spreadsheet.",
    image: "",
    sections: [
      {
        title: "JSON Gymnastics",
        description:
          "`jq` beyond `.key`: grouping, recursion and reshaping. Stretch first, these filters bend in ways you didn't know JSON could.",
        problems: ["group-chat", "json-to-csv", "buried-treasure"],
      },
      {
        title: "CSV & Friends",
        description:
          "Joins, pivots and the horrors of quoted fields. Spreadsheets were a mistake, but now they're your mistake.",
        problems: ["join-the-party", "pivot-the-grades", "comma-chaos"],
      },
      {
        title: "Config Files",
        description:
          "Every app has a config file, and no two of them agree on a format. Read them, convert them, and find that one value buried in the wrong section.",
        problems: ["env-to-json", "ini-detective"],
      },
    ],
  },
  {
    slug: "secrets-and-ciphers",
    name: "Secrets & Ciphers",
    description:
      "Spies, pirates and paranoid friends keep sending you encoded messages. Decode them, crack them, and catch whoever tampered with your downloads.",
    image: "",
    sections: [
      {
        title: "Encodings",
        description:
          "base64 and hex: ways of hiding text in plain sight that fool exactly nobody with a terminal.",
        problems: ["base64-postcard", "hex-marks-the-spot"],
      },
      {
        title: "Ciphers",
        description:
          "ROT13, Caesar, and a seven-layer cake of both. Real cryptographers, look away now.",
        problems: ["rot13-roulette", "caesar-salad", "layer-cake"],
      },
      {
        title: "Integrity",
        description:
          "Passwords hiding in binaries and downloads that aren't what they claim to be. Trust nothing; check everything.",
        problems: ["strings-attached", "trust-but-verify"],
      },
    ],
  },
  {
    slug: "archive-janitor",
    name: "Archive Janitor",
    description:
      "Tarballs, zips, empty files, duplicates and disk hogs. Become the janitor every server deserves. 🧹",
    image: "",
    sections: [
      {
        title: "Unpacking",
        description:
          "`tar`, `gzip`, `zip` and every combination of them. Somebody, somewhere, thought one layer of compression wasn't enough.",
        problems: ["unwrap-the-present", "zip-peek", "matryoshka"],
      },
      {
        title: "Cleaning House",
        description:
          "Find the junk that's eating your disk and get rid of it. Grab a mop: `find`, `du` and `md5sum` are in the closet.",
        problems: [
          "the-heavyweight",
          "ghost-files",
          "double-trouble",
          "disk-hog",
        ],
      },
    ],
  },
  {
    slug: "talking-to-servers",
    name: "Talking to Servers",
    description:
      "Your Twitter clone at `localhost:4000` is back, and it has learned new tricks. Headers, status codes, auth, cookies, pagination and retries: all with `curl`.",
    image: "",
    sections: [
      {
        title: "Reading the Room",
        description:
          "A response is more than its body. Learn to read the status code, eavesdrop on the headers and ask questions the server actually understands.",
        problems: ["pulse-check", "header-whisperer", "search-party"],
      },
      {
        title: "Getting In",
        description:
          "Some doors need a password, others need a cookie. Grandpa's vault and the admin dashboard are waiting.",
        problems: ["grandpas-vault", "cookie-monster"],
      },
      {
        title: "Making Changes",
        description:
          "`PUT` and `DELETE`: fixing your mistakes, erasing other people's, and living with the consequences.",
        problems: ["fix-the-typo", "delete-the-evidence"],
      },
      {
        title: "Persistence",
        description:
          "Servers paginate, servers nap, servers fail. You keep going until they cooperate.",
        problems: ["page-turner", "try-try-again"],
      },
    ],
  },
]
