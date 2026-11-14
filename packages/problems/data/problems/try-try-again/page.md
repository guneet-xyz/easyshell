# Problem Statement

To save money, your boss moved the Twitter clone's beloved **fortune cookie** feature to a free-tier server. You know the kind: it falls asleep when nobody's looking, and the first few requests after a nap get a grumpy `503 Service Unavailable` while it rubs its eyes and looks for its glasses.

The fortune appears on every user's home page, so your script has to fetch it no matter how grumpy the server is. Refreshing by hand is not a strategy. Neither is showing users "503 Service Unavailable: the server hit snooze" as their fortune (although, honestly, it's pretty accurate).

Keep asking until the server answers. Politely. Repeatedly.

# Instructions

1. Send `GET` requests to `http://localhost:4000/fortune` until one of them succeeds with status `200`.
2. The server fails a few times in a row (with status `503`) before it succeeds. It may also succeed on the very first try. Once it succeeds, it keeps succeeding.
3. Print **only** the body of the successful response. Don't print anything from the failed responses.

> **Note:** The bodies of the failed responses can look a lot like fortunes. Decide by the status code, not by the body. The server wakes up after at most 5 failed requests, so there's no need to wait between retries.

# Example

If the requests go like this:

```
HTTP/1.1 503 Service Unavailable

503 Service Unavailable: the server is still asleep. Zzz...
```

```
HTTP/1.1 200 OK

A bug you fixed today will come back on Friday at 4:59 p.m.
```

you should print:

```
A bug you fixed today will come back on Friday at 4:59 p.m.
```
