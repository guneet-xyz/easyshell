# Problem Statement

It's 3 a.m. again (it's always 3 a.m. in this series), and something is hammering your API. No human refreshes a feed more than 20 times a minute. Not even you, waiting for Melon Usk to reply to your post.

You're putting together a ban list for the firewall. One of these bots is probably Kevin's scraper, checking whether you've posted about him. But be careful: Grandma refreshes her feed every half minute, all night long, "in case someone replied". She is not a bot. Ban Grandma and you can forget about Thanksgiving.

# Instructions

1. `access.log` uses the same format as in _Who Knocked?_:

   ```
   203.0.113.66 - - [14/Nov/2026:03:14:07 +0000] "GET /api/feed HTTP/1.1" 200 5123 8
   ```

   The client's IP address is the first field. It can be IPv4 or IPv6.

2. A calendar minute is the date, hour and minute of the timestamp, like `14/Nov/2026:03:14` above: it covers every request stamped from `03:14:00` to `03:14:59` on that day.
3. An IP address is a bot if it made **more than 20** requests within a single calendar minute. Exactly 20 is still human (barely).
4. Only requests in the same calendar minute count together. 15 requests at `03:59` and 15 at `04:00` don't make a bot, even if they all came within 30 seconds. And `03:17` on 13 Nov and `03:17` on 14 Nov are different minutes.
5. Print every bot's IP address once, one per line, sorted as plain text, the way `sort` sorts lines by default (`10.0.0.10` comes before `10.0.0.9`).
