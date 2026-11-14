# Problem Statement

Remember when your friend's emailing script needed `clients.csv` as JSON, and you converted it (twice)? Karma has noticed.

Your Twitter clone at `localhost:4000` now has a beautiful JSON API, and you are very proud of it. Brenda from Finance is not. Brenda would like the user list "as a normal spreadsheet, like a normal person", and she would like it by lunch. She does not want to hear the word "endpoint" ever again.

You have the users exported in `users.json`:

```json
[
  {
    "id": 12,
    "name": "Usk, Melon",
    "email": "melon@chirp.dev",
    "plan": "ultra-mega"
  },
  {
    "id": 13,
    "name": "Dwayne \"The Rock\" Johnson",
    "email": "therock@chirp.dev",
    "plan": "pro"
  }
]
```

Melon Usk's name has a comma in it, because of course it does. Somebody's name has double quotes in it. Brenda's spreadsheet program must not choke on either.

# Instructions

1. `users.json` is a JSON array of user objects. Every user has an `id` (a whole number), a `name` and an `email` (strings), plus any number of other fields, in any key order. Ignore the other fields.
2. Print a CSV with three columns, in this order: `id`, `name`, `email`.
3. The first line is the header. Then print one line per user, in the same order as in `users.json`.
4. Format every line exactly like `jq`'s `@csv` does:
   - fields are separated by commas, with no spaces;
   - numbers are printed as they are;
   - strings are wrapped in double quotes, and every `"` inside a string is doubled (`""`).
5. The header follows the same rule, so it is `"id","name","email"`.

# Example

For the `users.json` above, the output is:

```csv
"id","name","email"
12,"Usk, Melon","melon@chirp.dev"
13,"Dwayne ""The Rock"" Johnson","therock@chirp.dev"
```

> **Note:** the commas inside the quotes are safe: a spreadsheet keeps `Usk, Melon` in one cell. Brenda will never know how close she came to chaos.
