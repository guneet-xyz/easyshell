# Problem Statement

Inspired by your boss's new passion for organizing, the intern has discovered folders. All of them. At once.

Every email attachment now gets saved like a Russian doll: `inbox/2024/q3/clients/acme/final/FINAL/invoice.pdf`. Seven folders deep, for one invoice. Finding anything takes longer than the meeting it's for, and your boss has started printing out `ls` output and "reviewing it offline".

He wants it fixed: every file in one flat folder. But after the Great `logs/` Deletion he trusts nobody, so nothing may lose track of where it came from. The folders a file was in have to survive as part of its name.

# Instructions

1. Find every file inside a subdirectory of `inbox/`, at any depth. Hidden files and files inside hidden folders (names starting with a `.`) count too.
2. Move each one directly into `inbox/`. Its new name is its path relative to `inbox/`, with every `/` replaced by a `-`: `inbox/2024/q3/invoice.pdf` becomes `inbox/2024-q3-invoice.pdf`.
3. Keep the rest of the name exactly as it is, spaces included: `inbox/Q3 Reports/final (2).pdf` becomes `inbox/Q3 Reports-final (2).pdf`.
4. Files that are already directly in `inbox/` stay as they are, and nothing outside `inbox/` changes.
5. The empty folders left behind don't matter: delete them or keep them, the grader ignores them.

# Example

Before:

```
inbox/
├── todo.txt
├── acme/
│   └── invoice.pdf
└── 2024/
    └── q3/
        └── report.txt
```

After:

```
inbox/
├── 2024-q3-report.txt
├── acme-invoice.pdf
└── todo.txt
```

# Constraints

- No two files end up with the same name.
- No file or folder name contains a newline.
