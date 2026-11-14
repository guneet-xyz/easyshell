# Problem Statement

It's 11:58 p.m. You just announced your new job on your own Twitter clone:

> I love my new jog!

Jog. **Jog.** You don't jog. You have never jogged. And your new boss (the one who yelled at you about bearer tokens) follows you and checks his feed at exactly 6:00 a.m. every day.

There's no "edit" button in the web UI yet (that's on the roadmap, right after "dark mode" and "stop Melon Usk"). But the API supports replacing a post with a `PUT` request. Your corrected post is ready in `fix.json`, and your trusty bearer token is still lying around in `token.txt`.

Fix it. Quietly.

# Instructions

1. `fix.json` contains the `id` of your post and its corrected `content`:

   ```json
   {
     "id": 1337,
     "content": "I love my new job!"
   }
   ```

2. Send a `PUT` request to `http://localhost:4000/posts/<id>`, with `<id>` replaced by the post's `id`.
3. Authenticate with the bearer token from `token.txt`, in the `Authorization` header:

   ```
   Authorization: Bearer <token>
   ```

4. The request body must be a JSON object whose `content` field is **exactly** the `content` from `fix.json`. The content may contain quotes, backslashes, tabs, newlines and emoji, so make sure your body is valid JSON.
5. The server replaces the post and responds with the updated post:

   ```json
   {
     "id": 1337,
     "author": "easyshell-user",
     "content": "I love my new job!",
     "revision": "2-3c6cfcf0"
   }
   ```

   The `revision` is the number of edits followed by a hash of the content, so it changes if the content is even one character off.

6. Print **only** the value of the `revision` field, without quotes.

> **Note:** Send only one `PUT` request. Every edit bumps the revision number, so a second edit gives a different revision.

# Example

For the response above, you should print:

```
2-3c6cfcf0
```
