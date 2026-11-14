# Problem Statement

Melon Usk (yes, _that_ Melon Usk, whose hot take you fetched back in Get It Curl) has been posting on your Twitter clone all night. He bought the moon. He declared gravity optional. He announced he's buying Captain Shellbeard's ship, and the Captain is _not_ selling.

At 6:47 a.m., Legal calls. They haven't slept. They speak very slowly and very calmly:

> "Delete. Every. Post. By Melon Usk. **Only** his. If you delete anything else, we're suing _you_."

There's no admin panel, but the API has a `DELETE` endpoint (it requires no authentication at all; security is scheduled for next sprint). Once you're done, Legal's own endpoint checks your work and, if everything is in order, issues a clearance certificate.

Careful: Melon has a fan club, a parody account and at least one impersonator, and they all have very similar names.

# Instructions

1. `GET http://localhost:4000/posts` returns all posts as a JSON array:

   ```json
   [
     {
       "id": 101,
       "author": "Grandma",
       "content": "Good morning everyone! Cookies at 3."
     },
     {
       "id": 108,
       "author": "Melon Usk",
       "content": "Just bought the moon. Renaming it to X."
     }
   ]
   ```

2. Delete **every** post whose `author` is **exactly** `Melon Usk` (case-sensitive) by sending `DELETE http://localhost:4000/posts/<id>` for each of them. Don't delete any other post: authors like `Melon Usk Fan Club`, `melon usk` or `Melon` are innocent, and so are posts that merely mention Melon Usk in their content.
3. If there are no posts by `Melon Usk`, don't delete anything.
4. Finally, send `GET http://localhost:4000/legal/clearance`. If exactly the right posts were deleted, it responds with:

   ```json
   {
     "cleared": true,
     "remaining_posts": 3,
     "certificate": "CASE-1234-CLOSED",
     "message": "All clear. Legal can finally go to sleep."
   }
   ```

   Otherwise `cleared` is `false`, `certificate` is `null` and the `message` explains what went wrong.

5. Print **only** the value of the `certificate` field, without quotes.

> **Note:** The server remembers what you deleted, and deleted posts can't be restored. In the terminal, you can always check `/legal/clearance` along the way to see how you're doing.

# Example

For the clearance response above, you should print:

```
CASE-1234-CLOSED
```
