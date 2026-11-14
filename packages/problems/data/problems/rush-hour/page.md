# Problem Statement

The infra team (two people, both named Dave) wants to schedule maintenance. Last time the intern deployed during peak traffic, Grandma called the support line 14 times, and the support line is your personal phone.

The Daves want a window when the fewest people will be angry. To find it, you first need to know when the _most_ people are doomscrolling, so you can stay as far away from that hour as possible.

# Instructions

1. `access.log` uses the same format as in _Who Knocked?_:

   ```
   203.0.113.7 - - [14/Nov/2026:21:05:33 +0000] "GET /api/feed HTTP/1.1" 200 5123 87
   ```

   The hour is the two digits right after the year in the timestamp (`21` above). All times are in UTC.

2. Count the requests in each hour of the day, from `00` to `23`. The log can cover several days, and the same hour on different days counts together: requests at `21:05` on 13 Nov and at `21:40` on 14 Nov both count for hour `21`.
3. Print the busiest hour and its number of requests, separated by a space, like `21 1337`. Always write the hour with two digits (`07`, not `7`).
4. If several hours tie for the most requests, print the earliest one (`09` beats `18`).
5. Watch out: IPv6 addresses (like `2001:db8::1`) contain colons too.

# Example

For this `access.log`:

```
203.0.113.7 - - [13/Nov/2026:21:05:33 +0000] "GET /api/feed HTTP/1.1" 200 5123 87
2001:db8::1 - - [13/Nov/2026:22:10:02 +0000] "GET / HTTP/1.1" 200 1530 64
198.51.100.42 - - [14/Nov/2026:07:15:40 +0000] "GET /api/feed HTTP/1.1" 200 20480 112
2001:db8::1 - - [14/Nov/2026:21:40:12 +0000] "GET /api/trending HTTP/1.1" 200 9811 45
```

you should print

```
21 2
```
