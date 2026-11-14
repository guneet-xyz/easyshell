# Problem Statement

Users are reporting errors, and the team chat has turned into a courtroom drama. The frontend team blames the backend. The backend team blames the database. The database team is "looking into it" (they're at lunch). The intern blames Mercury retrograde.

Your boss doesn't care whose fault it is: "I want to know _what_ is broken, and I want it before the next investor call." Luckily, the logs have no opinions and no lunch break. Find the endpoint that's throwing the most server errors and let the evidence settle it.

# Instructions

1. `access.log` uses the same format as in _Who Knocked?_:

   ```
   203.0.113.7 - - [14/Nov/2026:10:05:33 +0000] "GET /api/feed?page=2 HTTP/1.1" 502 1234 2310
   ```

   The path is the 7th space-separated field (`/api/feed?page=2`) and the status code is the 9th (`502`).

2. A server error is a request with a status code from `500` to `599` (`500`, `502`, `503`, `504`, ...). Ignore every other request, including `4xx` errors: those are the users' fault. Only the status field counts: a `200` response of `500` bytes is not a server error.
3. Group the server errors by path, ignoring the query string: drop everything from the first `?` on, so `/api/feed?page=2` counts as `/api/feed`. The method doesn't matter.
4. Print only the path with the most server errors. There is always exactly one such path.

# Example

For this `access.log`:

```
203.0.113.7 - - [14/Nov/2026:10:05:33 +0000] "GET /api/feed?page=2 HTTP/1.1" 502 1234 2310
198.51.100.42 - - [14/Nov/2026:10:05:40 +0000] "POST /api/posts HTTP/1.1" 500 1530 1840
10.0.0.3 - - [14/Nov/2026:10:06:02 +0000] "GET /wp-admin HTTP/1.1" 404 1024 12
10.0.0.3 - - [14/Nov/2026:10:06:03 +0000] "GET /wp-admin HTTP/1.1" 404 1024 11
203.0.113.7 - - [14/Nov/2026:10:06:09 +0000] "GET /api/feed?page=3 HTTP/1.1" 503 1234 3002
198.51.100.42 - - [14/Nov/2026:10:06:30 +0000] "GET /api/feed HTTP/1.1" 200 20480 112
```

you should print

```
/api/feed
```
