# Problem Statement

The Strokes have been very busy on your Twitter clone. Every time they play a song, they post about it. Every. Single. Time.

Their record label wants to know exactly how many posts the band has made, for "engagement analytics" (they're deciding whether to buy the band a social media manager or a muzzle). Your boss volunteered you, obviously.

There's a catch: the `/posts` endpoint is **paginated**. It only returns 10 posts at a time, plus a link to the next page. And last week the intern "optimized" the database and renumbered the pages, so page numbers now skip around, and some old pages that nobody links to anymore are still lying around.

Nobody is clicking "next" forty times. You're going to make the shell do it.

# Instructions

1. `GET http://localhost:4000/posts?page=1` returns the first page:

   ```json
   {
     "posts": [
       {
         "id": 1010,
         "author": "The Strokes",
         "content": "Now playing: \"Reptilia\" 🎸"
       },
       { "id": 1011, "author": "Grandma", "content": "Cookies are ready!" }
     ],
     "next": 3
   }
   ```

2. `next` is the number of the page to request next, or `null` on the last page. Starting from page 1, keep following `next` until it is `null`.
3. Page numbers are **not** necessarily consecutive (page 1 can link to page 3), and pages that are not reachable from page 1 by following `next` don't count, even if they exist.
4. Count the posts on all the pages you visited whose `author` is **exactly** `The Strokes` (case-sensitive). Authors like `The Strokes Fan Club`, `the strokes` or `Not The Strokes` don't count.
5. Print **only** that count.

# Example

If page 1 is the response above and page 3 is:

```json
{
  "posts": [
    {
      "id": 1020,
      "author": "The Strokes",
      "content": "Now playing: \"Someday\" 🎸"
    }
  ],
  "next": null
}
```

then The Strokes made 2 posts, and you should print:

```
2
```
