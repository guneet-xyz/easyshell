# Problem Statement

Your contact at the embassy is extremely dramatic. They wear sunglasses indoors, refer to the office printer as "the asset", and once sent you a voice note that was just heavy breathing followed by "you know what to do".

Today `message.txt` arrived. Every line is written backwards, **and** the lines are in reverse order, so the last line of the file is actually the first line of the message. "For security," they said. You suspect it's mostly for the drama.

You are not going to read it in a mirror while standing on your head. You have a shell.

# Instructions

1. Decode `message.txt` and print the result:
   - reverse the order of the lines (the last line becomes the first), and
   - reverse the characters within each line.
2. Blank lines stay blank; they just move along with everything else.

# Example

If `message.txt` contains:

```
.noon ta teeM
,tnegA
```

you should print:

```
Agent,
Meet at noon.
```
