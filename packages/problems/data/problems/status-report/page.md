# Problem Statement

The investors have been told a number (thanks to you, an _accurate_ one). Now your boss bursts into the room: "I need a status report. On my desk. Five minutes." Before you can ask what kind of status report, he's gone, leaving only the smell of cold brew behind.

You could write three paragraphs about synergy. Or you could take him literally and count the HTTP status codes in `access.log`. Malicious compliance is still compliance.

A quick refresher for the boss: `2xx` means it worked, `3xx` means "look over there", `4xx` means the user messed up and `5xx` means _you_ messed up. And if you spot a `418 I'm a teapot`, that's Grandma's smart kettle. Nobody knows how it got an account.

# Instructions

1. `access.log` uses the same format as in _Who Knocked?_:

   ```
   203.0.113.7 - - [14/Nov/2026:09:12:45 +0000] "GET /api/feed?page=2 HTTP/1.1" 200 5123 87
   ```

   The status code is the 9th space-separated field, right after the request line (`200` above).

2. For every status code that appears in the log, print one line with the status code, a space, and the number of requests that got that status.
3. Sort the lines by status code, smallest first.
4. Only the status field counts. Other fields can contain three-digit numbers too: the path `/api/posts/404`, a response of `500` bytes or a response time of `200` ms are not statuses.

# Example

For this `access.log`:

```
203.0.113.7 - - [14/Nov/2026:09:12:45 +0000] "GET /api/feed HTTP/1.1" 200 5123 87
198.51.100.42 - - [14/Nov/2026:09:12:50 +0000] "GET /api/posts/404 HTTP/1.1" 200 500 31
203.0.113.7 - - [14/Nov/2026:09:13:02 +0000] "POST /api/posts HTTP/1.1" 500 1530 2304
10.0.0.3 - - [14/Nov/2026:09:13:09 +0000] "GET /api/posts/999 HTTP/1.1" 404 1024 12
198.51.100.42 - - [14/Nov/2026:09:13:30 +0000] "GET /api/feed HTTP/1.1" 200 20480 112
```

you should print

```
200 3
404 1
500 1
```
