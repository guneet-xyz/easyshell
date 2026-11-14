# Problem Statement

For a whole week, someone has been requesting `/wp-admin` on your Twitter clone. Your Twitter clone is not WordPress. It has never been WordPress. It will never be WordPress. And still they knock, every night, like a raccoon at a locked trash can.

Your boss wants the total number of `404 Not Found` responses for the "security report" (a slide with a big red number on it). Easy, except that logrotate has been tidying up behind you: yesterday's log was renamed to `access.log.1`, and everything older was gzipped into `access.log.2.gz`, `access.log.3.gz` and so on.

So who hid the evidence? Logrotate, in the server room, with the cron job. Time to dig it back up.

# Instructions

1. Your current directory contains:
   - `access.log`: today's log. It can be empty if logrotate just ran.
   - `access.log.1`: yesterday's log, as plain text.
   - `access.log.2.gz`, `access.log.3.gz`, ...: older logs, compressed with gzip.

   Any of the rotated files can be missing (yes, even `access.log.1`). Count whatever is there.

2. Every log uses the same format as in _Who Knocked?_:

   ```
   203.0.113.7 - - [12/Nov/2026:03:05:33 +0000] "GET /wp-admin HTTP/1.1" 404 1234 12
   ```

   The status code is the 9th space-separated field (`404` above).

3. Print the total number of requests with status `404` in all the logs, as a single number.
4. Only the status field counts: a request for `/api/posts/404`, a response of `404` bytes or a response time of `404` ms is not a 404.
