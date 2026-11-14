# Problem Statement

Production is down, and the intern has good news: "Don't worry, I made a backup!" It's `backup.zip`, it's in your home directory, and it definitely, _definitely_ contains last night's database dump.

The intern also swore that the coffee machine was "basically a server" and that `rm -rf` stands for "remove really fast files". So before you restore production from this thing, you'd like to know what's actually inside.

There's a catch: the last time someone unzipped a mystery archive on this server, it sprayed files all over the home directory and overwrote the `notes.txt` you'd spent all week on. You are not unzipping anything. You're just going to **peek**.

# Instructions

1. List the paths of all the **files** stored in `backup.zip`, one per line, exactly as they are stored in the archive (for example `dump/users.sql`).
2. **Don't list directories.** Some zips contain separate entries for folders (like `dump/`); leave those out. A folder that contains no files at all doesn't show up in your output.
3. Every file counts: hidden files (like `.passwords.txt`) and empty files too.
4. File and folder names may contain spaces. Print them in full.
5. Sort the lines the way `sort` sorts them (in this terminal, that's plain byte order: uppercase letters before lowercase ones).
6. **Don't extract anything.** Print only what's inside the zip, not the files that are already lying around in the current directory.

# Example

If `unzip` would extract `README.txt`, `dump/` and `dump/users.sql`, the output is:

```
README.txt
dump/users.sql
```
