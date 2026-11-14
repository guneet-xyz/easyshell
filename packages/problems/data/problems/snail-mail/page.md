# Problem Statement

A new support ticket lands in your inbox:

> the app is slow sometimes. also how do i make the letters bigger. love, grandma

Very actionable. You can't fix "sometimes", but you can find out which requests are the slowpokes. Luckily, your server writes down how long it took to answer every request, right there at the end of each line of `access.log`. Somewhere in there, a request is slower than a snail carrying a fridge.

# Instructions

1. `access.log` uses the same format as in _Who Knocked?_:

   ```
   203.0.113.7 - - [14/Nov/2026:11:05:33 +0000] "GET /api/feed?page=2 HTTP/1.1" 200 5123 4200
   ```

   The last field is the response time in milliseconds (`4200` above). The method (`GET`) and the path (`/api/feed?page=2`) are in the request line.

2. Find the 5 slowest requests: the ones with the largest response times. Response times are whole numbers with different numbers of digits: `10500` is slower than `9950`.
3. Print one request per line as the response time, the method and the path, separated by single spaces: `4200 GET /api/feed?page=2`. Print the method without the quote, and the path exactly as it is in the log, query string included.
4. Print the slowest request first.
5. If several requests have the same response time, keep them in the order they appear in the log.
6. If the log has fewer than 5 requests, print all of them.

# Example

For this `access.log`:

```
203.0.113.7 - - [14/Nov/2026:11:05:33 +0000] "GET /api/feed?page=2 HTTP/1.1" 200 5123 4200
198.51.100.42 - - [14/Nov/2026:11:05:40 +0000] "POST /api/posts HTTP/1.1" 201 1530 64
10.0.0.3 - - [14/Nov/2026:11:06:02 +0000] "GET /api/trending HTTP/1.1" 200 1024 980
198.51.100.42 - - [14/Nov/2026:11:06:30 +0000] "GET /api/search?q=cats HTTP/1.1" 200 20480 10500
203.0.113.7 - - [14/Nov/2026:11:06:41 +0000] "GET / HTTP/1.1" 200 5123 980
10.0.0.3 - - [14/Nov/2026:11:07:12 +0000] "GET /favicon.ico HTTP/1.1" 200 1150 3
```

you should print

```
10500 GET /api/search?q=cats
4200 GET /api/feed?page=2
980 GET /api/trending
980 GET /
64 POST /api/posts
```
