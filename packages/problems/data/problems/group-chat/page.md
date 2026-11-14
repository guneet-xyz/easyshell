# Problem Statement

Your friend group has a group chat. Your friend group also has a problem: **Dave**.

Everyone agrees that Dave talks the most. Dave agrees that Dave is "basically a monk". This has been going on for three weeks, has produced roughly four hundred messages (mostly Dave's), and has now escalated to Dave typing "show me the DATA" in all caps.

Fine. You exported the chat to `messages.json`. Time to show Dave the data.

Each message looks like this:

```json
{
  "user": "Dave",
  "text": "jq is just a fancy grep",
  "ts": "2026-11-10T19:05:01Z"
}
```

# Instructions

1. The chat export is `messages.json`: a JSON array of message objects, each with a `user`, a `text` and a `ts` field.
2. Count how many messages each `user` sent. Users are compared by their exact name: `Dave` and `Dave_Backup` are two different users, no matter what anyone suspects.
3. Print a single JSON object that maps each user to their message count.
4. The keys must be sorted alphabetically, the way `jq` sorts keys (plain character order).
5. Print the object in `jq`'s default pretty-printed format (two-space indentation, one key per line).
6. If the chat is empty (`[]`), print `{}`.

# Example

For this `messages.json`:

```json
[
  {
    "user": "Zoe",
    "text": "dave talks the most",
    "ts": "2026-11-10T19:00:01Z"
  },
  { "user": "Dave", "text": "lol no", "ts": "2026-11-10T19:00:04Z" },
  { "user": "Dave", "text": "absolutely not", "ts": "2026-11-10T19:00:05Z" }
]
```

the output is:

```json
{
  "Dave": 2,
  "Zoe": 1
}
```

Case closed. Dave will dispute it anyway.
