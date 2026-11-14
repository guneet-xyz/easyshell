# Problem Statement

Your best friend Sam is getting married in an hour, and you're the best man. You've rehearsed the speech in the mirror. You've rehearsed it in the shower. You've rehearsed it for the Uber driver, who gave it four stars.

Then you read it one last time and realise it mentions Kevin, Sam's ex, **fourteen times**. You don't know how this happened. Kevin is also, somehow, on the guest list. Table 6.

There's no time to rewrite the speech. There is, however, time for one quick command.

# Instructions

1. In `speech.txt`, replace **every** occurrence of the text `Kevin` with `[REDACTED]`.
2. That includes every `Kevin` on a line that mentions him more than once, and every `Kevin` that's part of a longer word: `Kevin's` becomes `[REDACTED]'s` and `#TeamKevin` becomes `#Team[REDACTED]`.
3. `Kevin` is always spelled with exactly that capitalisation.
4. Edit `speech.txt` **in place**: when you're done, `speech.txt` must contain the redacted speech and must be the only file in the directory. Everything apart from the Kevins stays exactly as it was.
5. Only the file is checked; it doesn't matter what you print.

# Example

This line:

```
Kevin and Sam did everything together. Kevin's mum still sends Sam a Christmas card.
```

becomes:

```
[REDACTED] and Sam did everything together. [REDACTED]'s mum still sends Sam a Christmas card.
```
