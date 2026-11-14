# Problem Statement

You have a pen pal! His name is Gerald, he travels the world, and he sends you a postcard from every city he visits. How charming. How old-fashioned.

Except Gerald is a backend engineer, and he refuses to send anything over the wire that isn't base64-encoded "for transport safety". The postcard is paper. It arrives by plane. The mail carrier does not care about transport safety. Gerald does not care that the mail carrier does not care.

So every postcard looks like a cat walked across a keyboard, and today's has just been scanned into `postcard.txt`. Time to find out where Gerald is and what he's eaten.

# Instructions

1. The file `postcard.txt` contains a base64-encoded message.
2. The base64 text may be wrapped across several lines, or written on one long line.
3. Decode it and print the original message, exactly as Gerald wrote it (including its line breaks and any emoji).

# Example

If `postcard.txt` contains

```
SGVsbG8gZnJvbSBQYXJpcyEK
```

you should print

```
Hello from Paris!
```
