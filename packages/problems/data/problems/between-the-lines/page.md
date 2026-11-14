# Problem Statement

After the boss's lecture about keeping your API token in `token.txt` ("EXCELLENT security, truly"), you finally signed up for a password manager. Today you're switching to a different one, so you exported everything from the old one into `vault.txt`.

The export is a sandwich. Your actual secrets are the filling, wrapped between `-----BEGIN SECRET-----` and `-----END SECRET-----` lines. The bread is pages of legal disclaimers, terms of service, and the occasional passive-aggressive reminder not to reuse passwords. (You reused passwords.)

You want the filling, not the bread.

# Instructions

1. A secret block starts at a line that is **exactly** `-----BEGIN SECRET-----` and ends at the next line that is **exactly** `-----END SECRET-----`.
2. Print every line inside the blocks, in file order, **without** the marker lines themselves.
3. There may be several blocks; print the contents of all of them. Some blocks may be empty, and lines inside a block (including blank lines) are printed as they are.
4. A line that merely mentions `BEGIN`, `END` or `SECRET` but isn't exactly a marker line is ordinary text. Outside a block, it is not printed.
5. Blocks are never nested, every `BEGIN` line has a matching `END` line, and marker lines never appear inside a block.

# Example

For this `vault.txt`:

```
PassVault Pro(TM) export file
-----BEGIN SECRET-----
email: hunter2
-----END SECRET-----
Please do not read this file aloud on a bus.
-----BEGIN SECRET-----
bank: 1234
-----END SECRET-----
```

you should print:

```
email: hunter2
bank: 1234
```
