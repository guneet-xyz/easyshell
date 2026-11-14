# Problem Statement

Melon Usk posted a frog meme on your Twitter clone, and it was _so good_ that you saved it. Then you saved it again, in case the first one got lost. Then once more as `frog-final.jpg`. Then as `frog_copy_copy.jpg`, for reasons lost to history.

Fast forward a year: `memes/` is a swamp. The frog has taken over, the doge has cloned itself, and the stonks are going up only in the sense that there are more and more of them. Every copy is byte-for-byte identical to the original. Free your disk from the frog army.

(Before you ask: yes, these "JPEGs" are ASCII art. The budget for this problem didn't stretch to real JPEGs.)

# Instructions

1. Look at the files in `memes/`. Files with exactly the same content (byte for byte) form a group of duplicates.
2. In each group, **keep only the file whose name sorts first** and delete all the others.
3. "Sorts first" means byte order, the way `sort` and `ls` order names in this terminal. That's not always the name you'd guess: a space comes before `-` and `.`, and uppercase letters come before lowercase ones. For example, `frog (1).jpg` sorts before `frog.jpg`.
4. Files whose content is different from every other file are left alone, even if their names look alike. One extra character (a trailing newline, say) makes it a different meme.
5. Names may contain spaces and parentheses.
6. `memes/` contains only files: no subfolders and no hidden files.

# Example

If `frog.jpg`, `frog (1).jpg` and `frog-final.jpg` are identical, and `doge.jpg` is unique, then only `doge.jpg` and `frog (1).jpg` remain.
