# Problem Statement

You went to bed with 12 users: you, your mom, Grandma, Grandma's tablet and eight test accounts that are also you. Then Melon Usk posted a screenshot of your Twitter clone with the caption _"Just reinvented Twitter. Again."_ and went to sleep too.

You wake up to server fans howling like a jet engine and an `access.log` the length of a Russian novel. Your phone shows 37 missed calls from your boss and one text: "INVESTORS ARE ASKING HOW MANY USERS WE HAVE. GIVE ME A NUMBER. A BIG ONE."

You can't promise big, but you can promise _accurate_. Grab your magnifying glass, detective. Before anyone panics, establish the facts: how many different visitors knocked on your door last night?

# Instructions

1. The file `access.log` is in your current directory. Every request to your server left one line in it, like this one:

   ```
   203.0.113.7 - - [13/Nov/2026:23:41:07 +0000] "GET /api/feed?page=2 HTTP/1.1" 200 5123 87
   ```

   You'll be reading this format for the whole Log Detective series, so take a good look. Separated by single spaces, the fields are:
   - `203.0.113.7`: the client's IP address, either IPv4 or IPv6 (like `2001:db8::1`).
   - `- -`: two fields that are always `-`. Historical reasons. Don't ask.
   - `[13/Nov/2026:23:41:07 +0000]`: when the request arrived, always in UTC.
   - `"GET /api/feed?page=2 HTTP/1.1"`: the request line in quotes: the method, the path (sometimes with a `?query` string) and the protocol.
   - `200`: the HTTP status code.
   - `5123`: the size of the response in bytes.
   - `87`: how long your server took to answer, in milliseconds.

   Paths never contain spaces or quotes, and the lines are in time order.

2. Print the number of **unique** client IP addresses in `access.log`, and nothing else.
3. Two addresses belong to the same visitor only if they are exactly the same text: `10.0.0.1` and `10.0.0.10` are two different visitors. A visitor always shows up with its address written the same way.

# Example

For this `access.log`:

```
203.0.113.7 - - [13/Nov/2026:23:41:07 +0000] "GET / HTTP/1.1" 200 5123 87
198.51.100.42 - - [13/Nov/2026:23:41:09 +0000] "GET /api/feed HTTP/1.1" 200 20480 112
203.0.113.7 - - [13/Nov/2026:23:42:30 +0000] "POST /api/posts HTTP/1.1" 201 1530 64
2001:db8::1 - - [13/Nov/2026:23:45:12 +0000] "GET /api/trending HTTP/1.1" 200 9811 45
```

you should print

```
3
```

> **Note:** Yes, an IP address isn't exactly a human. Grandma's tablet and Grandma's laptop count twice, and a whole office behind one router counts once. The investors don't need to know that.
