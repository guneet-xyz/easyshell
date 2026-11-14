# Problem Statement

The intern has discovered a shiny new deploy tool. It is fast, it is beautiful, it has a logo shaped like a rocket, and it only accepts configuration as **JSON**.

Your Twitter clone's configuration lives in a `.env` file. It has about forty variables, written over the years by people who have since moved on to "new challenges". You are not typing all of that out by hand, and you are definitely not letting the intern do it (the intern's last "quick config tweak" took the site down for six hours, and the intern's laptop is still on fire).

```sh
# Chirp production config
APP_NAME=Chirp
PORT=4000

DATABASE_URL=postgres://melon:hunter2@db.internal:5432/chirp?sslmode=require
EDIT_BUTTON_ENABLED=false
```

# Instructions

1. The config is in `.env` (yes, it's a hidden file: `ls -a` will show it).
2. Skip empty lines and lines that start with `#`. A `#` anywhere else is just part of the value.
3. Every other line looks like `KEY=value`. Keys never contain `=`, but values can: split each line at the **first** `=` only.
4. The value is everything after that first `=`, exactly as written: don't strip quotes or spaces (`NAME="Chirp"` becomes `"\"Chirp\""`). A value can be empty (`EMPTY=`), which becomes an empty string.
5. Every value is a JSON string, even if it looks like a number or a boolean.
6. Print a single JSON object with one key per variable, in the same order as in the file, in `jq`'s default pretty-printed format (two-space indentation). Each key appears only once in the file.

# Example

For the `.env` above, the output is:

```json
{
  "APP_NAME": "Chirp",
  "PORT": "4000",
  "DATABASE_URL": "postgres://melon:hunter2@db.internal:5432/chirp?sslmode=require",
  "EDIT_BUTTON_ENABLED": "false"
}
```
