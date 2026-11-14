# Problem Statement

Your boss wants **shellfish 2.0** installed on every machine in the office by lunch. Naturally, the official download server picked this exact morning to go down, so you grabbed everything from the first mirror that showed up in the search results: `totally-legit-mirror.biz`. The site had three "DOWNLOAD NOW" buttons, a countdown timer and a dancing hot dog. Very professional.

Before you install anything (remember what happened last time the intern ran `curl ... | sh`?), you check. Luckily, the shellfish project publishes a `SHA256SUMS` file: a fingerprint for every file in the release. Change a single byte of a file and its fingerprint changes completely. If a file's fingerprint doesn't match the list, somebody has been "improving" it.

Time to find out who's been tampering.

# Instructions

1. Everything is in the `downloads/` directory, including `SHA256SUMS`.
2. Each line of `SHA256SUMS` has a SHA-256 checksum, two spaces and a file name (relative to `downloads/`), in the format that `sha256sum` prints. Every listed file exists.
3. Check every file listed in `SHA256SUMS`. Print the names of the files whose checksum does **not** match, one per line, sorted alphabetically (the way `sort` sorts them), without any `: FAILED` suffix.
4. Ignore files in `downloads/` that aren't listed in `SHA256SUMS`: they aren't part of the release (and you shouldn't open them anyway).
5. If every listed file matches, print exactly `ALL CLEAR`.

> **Note:** file names never contain spaces or colons, but they may contain the word `FAILED`. Judge each file by its checksum, not by its name.

# Example

If `downloads/` contained a `SHA256SUMS` listing `a.txt`, `b.txt` and `c.txt`, and the files `c.txt` and `a.txt` didn't match their checksums, you should print

```
a.txt
c.txt
```
