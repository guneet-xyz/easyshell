# Problem Statement

The backup worked. Your boss was happy for almost four whole minutes.

Then, during the all-hands meeting, he plugged his laptop into the projector and opened his `downloads/` folder in front of the entire company. Four years of tax returns, cat memes, the Zoom installer (twice), a file called `untitled (3)` and something called `.secret-plans.txt` that nobody is allowed to mention. HR is "looking into it".

Your boss has decided this is your problem now. He read somewhere that professionals sort their files by extension, so that's what you're doing, before the next all-hands. He'll be watching. On the projector.

# Instructions

1. Sort every file that sits **directly** inside `downloads/`. Files that are already in a subdirectory of `downloads/` stay exactly where they are, and so does everything outside `downloads/`.
2. Move each of those files, keeping its name, into the folder `downloads/<ext>/`, where `<ext>` is the file's extension: the text after the **last** dot in its name. `archive.tar.gz` goes to `downloads/gz/`.
3. Extensions are used exactly as they are, so case matters: `photo.JPG` goes to `downloads/JPG/` and `photo.jpg` goes to `downloads/jpg/`.
4. Files without an extension (no dot in the name) go to `downloads/misc/`.
5. Hidden files (names starting with a `.`) are sorted too, but their leading dot doesn't count: `.DS_Store` has no extension and goes to `downloads/misc/`, while `.secret-plans.txt` goes to `downloads/txt/`.
6. Create the folders you need. If a folder already exists, move the files into it, next to whatever is already there.

# Example

Before:

```
downloads/
├── cat.jpg
├── taxes.2023.pdf
├── untitled (3)
└── pdf/
    └── old-invoice.pdf
```

After:

```
downloads/
├── jpg/
│   └── cat.jpg
├── misc/
│   └── untitled (3)
└── pdf/
    ├── old-invoice.pdf
    └── taxes.2023.pdf
```

# Constraints

- No file name ends with a dot.
- No file in `downloads/` has the same name as a folder you need to create (there's no file called `misc` or `pdf`, for example).
