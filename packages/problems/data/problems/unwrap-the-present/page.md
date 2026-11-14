# Problem Statement

It's your birthday! 🎂 And Grandma has discovered computers.

Last week the intern helped her "send a file the way computer people do", and he did a very thorough job. This morning your birthday present landed in your home directory as `present.tar.gz`. No ribbon. No bow. Just a tarball, lovingly gzipped by a woman who still prints out her emails.

You can't hurt her feelings, so you're going to open it properly. And since she raised you right, you'll also clean up the wrapping paper afterwards instead of leaving it lying around your home directory for the next three years.

# Instructions

1. Extract `present.tar.gz` into the current directory. Keep the paths exactly as they are stored in the archive (if the archive contains `box/socks.txt`, you should end up with `./box/socks.txt`).
2. The present may contain folders, and hidden files (names starting with a `.`). Unwrap **everything**.
3. Delete `present.tar.gz` once it's unwrapped. No other leftovers either: if you make an intermediate file (like `present.tar`), delete it too.
4. Leave any other files in the current directory untouched.

# Example

If the current directory looks like this:

```
.
├── present.tar.gz
└── wishlist.txt
```

and the present contains `card.txt` and `box/socks.txt`, then afterwards it should look like this:

```
.
├── box
│   └── socks.txt
├── card.txt
└── wishlist.txt
```
