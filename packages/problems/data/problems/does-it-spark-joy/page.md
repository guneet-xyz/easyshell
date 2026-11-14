# Problem Statement

The intern is lovely. The intern is enthusiastic. The intern's editor also leaves trailing spaces at the end of every line, and their keyboard has an Enter key that sticks, so their notes look like they were written by someone falling down a staircase.

Code review has become 90% `nit: whitespace` comments. The boss has started calling it "the whitespace situation". Something must be done.

Channelling your inner Marie Kondo, you hold up each stray space in `notes.md` and ask: does it spark joy? It does not. Thank it for its service, and let it go.

# Instructions

Tidy up `notes.md` **in place**, following these rules:

1. Remove all trailing spaces and tabs from the end of every line.
2. A **blank line** is a line that is empty after rule 1. Lines that only contained spaces and tabs count as blank too.
3. Replace every run of two or more consecutive blank lines with a **single** blank line. This also applies at the very start and the very end of the file: a run there is shrunk to one blank line, not removed.
4. Leave everything else alone: indentation at the start of a line, spaces and tabs in the middle of a line, and single blank lines all stay exactly as they are.
5. `notes.md` ends with a newline, and it should still end with one afterwards.
6. When you're done, `notes.md` must be the only file in the directory. Only the file is checked; it doesn't matter what you print.

# Example

In this `notes.md`, `·` stands for a space and `→` for a tab:

```
#·Retro··
→
··

-·Nothing·caught·fire···
```

After tidying up, it should look like this:

```
# Retro

- Nothing caught fire
```
