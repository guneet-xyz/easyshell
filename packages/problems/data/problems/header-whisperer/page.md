# Problem Statement

The backend developer of your Twitter clone is painfully shy. They named the new release, and they're very proud of the codename, but they refuse to put it anywhere anyone might _see_ it. Not in the changelog, not in the response body, not in Slack.

Instead, they whispered it into an HTTP **response header** called `X-Secret-Codename`, on the home page at `http://localhost:4000/`. Then they put a few other `X-Secret-...` headers next to it, "for plausible deniability".

Your boss wants the codename for the launch party banner. Eavesdrop on the server and find out what it is.

# Instructions

1. Send a `GET` (or `HEAD`) request to `http://localhost:4000/`.
2. Find the response header named `X-Secret-Codename`. Header names are case-insensitive, so it may also show up as `x-secret-codename`.
3. Print **only** its value: no header name, no colon, no leading space, and no trailing carriage return (`\r`). A trailing newline is fine.

> **Note:** The response has other headers with similar names (like `X-Secret-Codename-Old` or `X-Not-Secret-Codename`). Only the header named exactly `X-Secret-Codename` counts. Its value may contain spaces and colons.

# Example

If the server responds with:

```
HTTP/1.1 200 OK
X-Secret-Codename: Bluebird
X-Secret-Snack: Cold pizza
Content-Type: text/plain; charset=utf-8
```

you should print:

```
Bluebird
```
