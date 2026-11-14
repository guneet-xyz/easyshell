# Problem Statement

You've landed a job as a line cook at _Il Cesare_, a fancy restaurant run by the legendary Chef Julius. He's a genius with lettuce and deeply paranoid about his recipes, so every note he pins to the kitchen board is encrypted with a **Caesar cipher**, the one his namesake used on his generals 2,000 years ago: every letter is shifted a fixed number of places along the alphabet, wrapping around from `Z` to `A`. With a shift of 3, `A` becomes `D`, `X` becomes `A` and `Hail` becomes `Kdlo`.

Remember Max's party invitation? ROT13 is just a Caesar cipher with a shift of 13. Chef Julius, however, picks a **new shift for every note** and tells no one. The sous-chef has been guessing for weeks. The sous-chef has made a lot of wrong salads.

You have one advantage: Chef Julius is a creature of habit. Every note he has ever written ends with his signature battle cry, `CROUTONS!`. There are only 25 possible shifts. That's not a cipher, that's a `for` loop.

Today's note is in `note.txt`.

# Instructions

1. `note.txt` was encrypted by shifting every letter forward by the same secret amount, between 1 and 25. Uppercase and lowercase letters were shifted the same way and kept their case. Everything else (digits, spaces, punctuation, line breaks) was left untouched.
2. Exactly one shift decrypts the note so that its **last line ends with `CROUTONS!`**.
3. Find that shift and print the whole decrypted note.

> **Note:** a wrong shift can still produce the word `CROUTONS` somewhere in the middle of the note (Chef Julius's nephew is Max. Yes, _that_ Max. He brought ROT13 into the kitchen.). Only the last line counts.

# Example

If `note.txt` contains

```
Ehvw vdodg lq Urph.
FURXWRQV!
```

(a shift of 3), you should print

```
Best salad in Rome.
CROUTONS!
```
