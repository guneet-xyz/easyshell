# Problem Statement

Your English teacher has made a bold claim: Shakespeare had the richest vocabulary in the history of the English language. Thousands of words! Hundreds he invented himself!

You have a theory of your own: the man mostly said `thou`. A lot. Possibly while pointing at people.

Rather than argue (you lost the last argument, about whether "yeet" belongs in an essay), you've decided to settle it with data science. Shell edition. Your teacher has handed you a piece of Shakespeare in `shakespeare.txt`. Time to count.

# Instructions

1. A **word** is a run of consecutive letters `A`–`Z` or `a`–`z`, as long as possible. Anything else (spaces, punctuation, digits, apostrophes, hyphens) separates words. So `summer's` is two words, `summer` and `s`, and `To-morrow` is `to` and `morrow`.
2. Ignore case: `Thou`, `THOU` and `thou` are the same word. Print words in lowercase.
3. Count every word in the file, including speaker names and stage directions.
4. Print the **5** most frequent words, one per line, in the format `<word> <count>`.
5. Order them by count, highest first. Words with the same count are ordered alphabetically.
6. Print exactly 5 lines, even when there's a tie for fifth place: the alphabetical tie-break decides who makes the cut.

# Example

For this `shakespeare.txt`:

```
To be, or not to be: that is the question.
Thou art, thou art... THOU ART!
```

you should print:

```
art 3
thou 3
be 2
to 2
is 1
```

Shakespeare would be proud. Or at least mildly entertained.
