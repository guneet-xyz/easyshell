# Problem Statement

Your bank balance is mysteriously low. You don't remember buying a yacht. You don't remember buying anything, really. Just the usual: rent, groceries, the occasional book, and a small coffee. Every morning. And sometimes after lunch. And that one time at midnight, which you don't want to talk about.

You exported your spending from the banking app into `expenses.csv`. You have a sinking feeling about one particular category, and you want a number before you lose your nerve.

# Instructions

1. `expenses.csv` starts with a header line, `date,category,amount`, followed by one expense per line. Fields never contain commas or quotes.
2. Add up the `amount` of every expense whose category is **exactly** `coffee`. Categories that merely contain the word, like `coffee beans` or `iced coffee`, don't count, no matter how much they feel like coffee.
3. Print the total with exactly two decimal places, like `35.25` or `7.50`.
4. If there are no `coffee` expenses at all, print `0.00`. (Congratulations, by the way.)

Amounts are positive and have at most two decimal places, but aren't always written with both: `4`, `3.5` and `3.50` are all valid amounts.

# Example

For this `expenses.csv`:

```
date,category,amount
2026-03-01,coffee,4.50
2026-03-01,coffee beans,18.99
2026-03-02,groceries,63.20
2026-03-02,coffee,3
```

you should print:

```
7.50
```
