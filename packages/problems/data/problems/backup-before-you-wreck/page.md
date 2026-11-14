# Problem Statement

Remember the Great `logs/` Deletion? You ran `rm -r logs`, your boss discovered that half of "his logs" were not logs at all, and you only survived because a backup happened to exist. Happened to. By pure luck.

Your boss has since read one (1) blog post about disaster recovery and now considers himself an expert. A laminated sign has appeared above your desk:

> **RULE #1: NOBODY TOUCHES `project/` WITHOUT A BACKUP.**
>
> **RULE #2: SEE RULE #1.**

Today you need to refactor `project/`. Your boss is standing directly behind you, sipping from a mug that says _World's Most Backed-Up Boss_, and he is not leaving until he has seen a backup. A complete one. "Hidden files too," he says, tapping the sign. "_Especially_ the hidden ones."

# Instructions

1. Copy the `project/` directory (in your current directory) to a new directory named `project.bak/`, next to it.
2. `project.bak/` must contain everything that is in `project/`: every file and every subdirectory, at any depth, with the same names and the same contents. That includes:
   - hidden files and hidden directories (names starting with a `.`),
   - names with spaces,
   - empty files.
3. `project.bak/` must be a copy of `project/`, not contain one: you want `project.bak/README.md`, not `project.bak/project/README.md`.
4. Leave `project/` exactly as it is, and don't touch anything else.

> **Note:** `project.bak/` doesn't exist yet.
