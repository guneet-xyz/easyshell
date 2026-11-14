# Problem Statement

The marketing team has discovered the space bar, and they love it. The shared folder is now full of files like `final report (FINAL) v2.txt` and `my cat  photo.png` (two spaces, and nobody knows why).

Every script you write explodes on contact. `rm final report.txt` tries to delete a file called `final` and another called `report.txt`. A loop over the files treats `my`, `cat` and `photo.png` as three separate things. Last week a filename with a `$` in it made a script quietly empty a variable, and you're still not over it.

Enough. You're fixing the filenames once and for all, and you're doing it _without_ tripping over the same spaces yourself.

# Instructions

1. For every **regular file directly in the current directory** whose name contains a space, rename it, replacing **each** space with an underscore (`_`).
2. Every single space counts:
   - consecutive spaces become consecutive underscores: `my cat  photo.png` → `my_cat__photo.png`
   - spaces at the very start or end of a name become underscores too: ` notes.txt` → `_notes.txt`
3. Names can also contain characters the shell loves to misinterpret, such as `'`, `$`, `(` and `)`. Keep every character other than spaces exactly as it is.
4. Leave files without spaces alone.
5. Don't rename directories, and don't touch anything inside them, even if their names contain spaces.
6. File contents must not change.

# Example

| Before                        | After                         |
| ----------------------------- | ----------------------------- |
| `final report (FINAL) v2.txt` | `final_report_(FINAL)_v2.txt` |
| `my cat  photo.png`           | `my_cat__photo.png`           |
| `README.txt`                  | `README.txt`                  |
| `Marketing Assets/logo.png`   | `Marketing Assets/logo.png`   |

# Constraints

- No two files will end up with the same name.
- There are no hidden files (names starting with `.`).
