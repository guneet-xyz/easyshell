# Problem Statement

Melon Usk got banned from your Twitter clone (again), and your boss wants him unbanned before he tweets about it on a _competitor's_ site. Easy: log in to the admin tool and click the button.

Small problem: you don't remember the admin password. You never wrote it down. You didn't put it in a password manager. You did something much worse: you **hard-coded it** into the admin tool, compiled it, and deleted the source code "to keep things tidy".

All you have left is the compiled program, `app.bin`. Opening it in a text editor shows mostly gibberish, but compiled programs keep their text (error messages, file paths and, yes, embarrassing hard-coded secrets) as plain characters between all the machine code. Somewhere in there is a string that starts with `PASSWORD=`.

# Instructions

1. `app.bin` is a binary file. Treat a run of printable ASCII characters (between non-printable bytes) as a **string**, like the `strings` command does.
2. Exactly one string **starts** with `PASSWORD=`. Print only the part after `PASSWORD=` (the password itself), on a single line.
3. Other strings may contain `PASSWORD` or `PASSWORD=` somewhere after their first character (like `OLD_PASSWORD=...`). Ignore them: they're decoys left over from your previous security incidents.
4. The password may contain any printable characters, including `=`. Print all of it.

# Example

If the strings inside `app.bin` were

```
Enter admin password:
OLD_PASSWORD=password1
PASSWORD=hunter2
GCC: (Alpine 14.2.0) 14.2.0
```

you should print

```
hunter2
```
