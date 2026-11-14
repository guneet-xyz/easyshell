# Problem Statement

It's 2 a.m. Your pager is screaming. Your Twitter clone at `localhost:4000` is either down, or Melon Usk has posted something so unhinged that the monitoring system fainted.

You squint at your terminal with one eye open. You could load the health page in a browser and read a whole HTML essay about it, but you don't want an essay. You want **one number**:

- `200` means everything is fine, and you go back to sleep.
- Anything else means coffee. Lots of coffee.

The health endpoint is at `http://localhost:4000/health`. Its body is an HTML page that rambles on about hamsters and may even contain other numbers. Ignore it. Only the status code matters.

# Instructions

1. Send a `GET` (or `HEAD`) request to `http://localhost:4000/health`.
2. Print **only** the HTTP status code of the response, as a 3-digit number (for example `200`). A trailing newline is fine.
3. Don't print the response body or any headers.

> **Note:** The status code is not always `200`. The body can contain numbers that look like status codes, so read the code from the response itself, not from the page.

# Example

If the server responds with:

```
HTTP/1.1 503 Service Unavailable
Content-Type: text/html; charset=utf-8

<h1>The hamster is taking a nap</h1>
```

you should print:

```
503
```
