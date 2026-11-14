# Problem Statement

It was 3 a.m. The servers were quiet. Too quiet. Then the app went down, and your phone lit up like a pinball machine. "THE APP CRASHED. AGAIN," texts your boss, who apparently never sleeps either.

You pour a coffee as black as the terminal and open `app.log`. The `FATAL` lines tell you who the victim is. But any detective worth their trench coat knows the real story is in what happened just _before_ the body hit the floor.

# Instructions

1. `app.log` has one event per line: a date, a time, a level, the component in brackets and a message.

   ```
   2026-11-14 03:01:04 FATAL [disk] no space left on device
   ```

2. A fatal line is any line that contains the exact text `FATAL` (uppercase) anywhere, even inside another word. Lowercase `fatal` doesn't count.
3. For every fatal line, print the 2 lines that come before it, then the fatal line itself. A fatal line near the top of the file gets only the lines that exist before it.
4. Print every line unchanged, in the order of the file, and never print a line twice. When the groups of two fatal lines overlap or touch, they merge into one group.
5. Between two groups that are not next to each other in the file, print a line containing only `--`. Don't print `--` before the first group or after the last one.

# Example

For this `app.log`:

```
2026-11-14 02:59:10 INFO [feed] served 20 posts in 41ms
2026-11-14 02:59:20 WARN [db] connection pool at 10/10
2026-11-14 02:59:31 ERROR [db] timed out waiting for a free connection
2026-11-14 02:59:32 FATAL [db] connection pool exhausted, shutting down
2026-11-14 02:59:40 INFO [supervisor] restarting the app
2026-11-14 03:00:02 INFO [auth] grandma logged in
2026-11-14 03:00:15 WARN [feed] heap at 61/64 MiB
2026-11-14 03:00:16 FATAL [feed] out of memory
```

you should print

```
2026-11-14 02:59:20 WARN [db] connection pool at 10/10
2026-11-14 02:59:31 ERROR [db] timed out waiting for a free connection
2026-11-14 02:59:32 FATAL [db] connection pool exhausted, shutting down
--
2026-11-14 03:00:02 INFO [auth] grandma logged in
2026-11-14 03:00:15 WARN [feed] heap at 61/64 MiB
2026-11-14 03:00:16 FATAL [feed] out of memory
```
