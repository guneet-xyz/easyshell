# Problem Statement

Remember your diary? The one you started in the terminal, with that heartfelt entry about redirection? That was also the last entry. Your diary has been silent ever since.

But it's a new month, and you're a new you. This month you're going to journal **every single day**. To prove your commitment, you'll create a journal file for every day of the month right now, before you lose your nerve. Each one will say `TODO`. For now. They'll get filled in. Probably. Definitely. Look, the important thing is that the files exist.

Some of you have tried this before. If an old `journal/` folder is lying around with a day 1 entry full of optimism, it gets overwritten. A fresh start is a fresh start.

# Instructions

1. `days.txt` contains the number of days in this month, a whole number from `1` to `31`.
2. Create a directory named `journal` in the current directory, if it doesn't already exist.
3. Inside `journal`, create one file for each day from `1` up to the number in `days.txt`, named `day-NN.txt`, where `NN` is the day number zero-padded to two digits: `day-01.txt`, `day-02.txt`, …, `day-10.txt`, …
4. Each file contains exactly one line, `Day N: TODO`, followed by a newline. Here `N` is the day number **without** padding: `Day 7: TODO`, not `Day 07: TODO`.
5. If a journal file already exists, replace its contents.
6. Don't create any other files, and leave every existing file outside `journal` untouched.

# Example

If `days.txt` contains `3`, you end up with:

| File                 | Contents      |
| -------------------- | ------------- |
| `journal/day-01.txt` | `Day 1: TODO` |
| `journal/day-02.txt` | `Day 2: TODO` |
| `journal/day-03.txt` | `Day 3: TODO` |
