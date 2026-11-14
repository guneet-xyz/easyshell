# Problem Statement

Captain Shellbeard is back, and this time he's brought a treasure map. Unfortunately, the Captain learned about JSON from a bottle that washed ashore, and he took to it a little too enthusiastically.

The map in `map.json` is nested deeper than the Mariana Trench: seas contain islands, islands contain caves, caves contain chests, and chests contain... more chests. Somewhere in all of that, every key named `gold` marks a pile of loot.

The crew wants to know how rich they're about to be before they start digging. The parrot keeps squawking a number, but you've learned not to trust the parrot.

```json
{
  "gold": 50,
  "islands": [
    { "name": "Bash Island", "gold": 100 },
    { "name": "Zsh Atoll", "gold": 250, "rum": 3 }
  ],
  "ship": { "name": "The Segfault", "gold": 75 }
}
```

# Instructions

1. The map is `map.json`, a single JSON value with objects and arrays nested to any depth.
2. Find every key named exactly `gold` at any depth, including in objects inside arrays. The match is exact and case-sensitive: keys like `golden`, `gold_count` or `Gold` are not gold.
3. Only number values count. A `gold` key whose value is a string, `null` or anything else that isn't a number is worth nothing. Text that merely mentions gold (inside a string value) doesn't count either.
4. Print the sum of all those numbers. All gold values are whole numbers.
5. If there is no gold at all, print `0`.

# Example

For the map above, the output is:

```
475
```

> **Note:** the Captain formats his JSON however he likes. Sometimes it's pretty, sometimes it's all on one line, and sometimes there's a space before the colon. Arr.
