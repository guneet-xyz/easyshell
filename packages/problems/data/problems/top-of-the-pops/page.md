# Problem Statement

Every music app does a Year-in-Review now, with confetti, gradients and a little card that says you're in the top 0.01% of listeners of a band you heard once by accident. Your startup's music app has none of that. What it does have is investors, and the investors want a Year-in-Review. By tomorrow.

The backend engineer quit last week (something about "a career in pottery"), but they left you `plays.log`: one song title per line, one line per play. The designers will handle the confetti. You just need the numbers.

Rumour has it the CEO listened to The Strokes on repeat all year. Let's find out.

# Instructions

1. Each line of `plays.log` is one play of the song whose title is the whole line.
2. Print the **3** most-played songs, one per line, in the format `<count> <title>` (the play count, one space, then the title, with no spaces before the count).
3. Order them by play count, highest first.
4. If songs have the same play count, order them alphabetically by title, in plain byte order (what `sort` does by default here: digits before uppercase letters, uppercase before lowercase).
5. Print exactly 3 lines, even when there's a tie for third place: the tie-break above decides who makes the cut.

# Example

For this `plays.log`:

```
Reptilia
Someday
Last Nite
Someday
Reptilia
Hard to Explain
Reptilia
Last Nite
```

you should print:

```
3 Reptilia
2 Last Nite
2 Someday
```
