# Problem Statement

Your Twitter clone at `localhost:4000` finally has **search**! The backend dev shipped it at 4:59 p.m. on a Friday, so naturally you're the one testing it.

Your boss wants to know how many posts mention `rock & roll` (he's planning a "brand activation" with The Strokes). You type the query straight into the URL like a normal human being:

```
http://localhost:4000/search?q=rock & roll
```

`curl` refuses to send a URL with spaces in it. Fine, you replace the spaces with `%20`. Now the server happily answers... with every post that mentions a `rock `. Kevin's new best friend (a rock). The intern's parking-lot rock. Melon Usk sending a rock to Mars.

The server saw `?q=rock%20&%20roll`, decided the `&` started a brand new parameter, and searched for `rock ` instead. URLs, it turns out, have opinions about `&`, `#`, `+`, `%` and spaces. Time to **URL-encode** your query properly.

The query for today is waiting in `query.txt`.

# Instructions

1. Read the search query from `query.txt`. The file contains a single line with the query, followed by a newline. The newline is not part of the query.
2. Send a `GET` request to `http://localhost:4000/search` with the query in the `q` query parameter, **URL-encoded** so that the server receives exactly the text from `query.txt`.
3. The server responds with JSON like this:

   ```json
   {
     "query": "rock & roll",
     "count": 2,
     "results": [
       {
         "id": 1,
         "author": "The Strokes",
         "content": "rock & roll will never die"
       },
       {
         "id": 2,
         "author": "Grandma",
         "content": "I danced to rock & roll in 1957."
       }
     ]
   }
   ```

4. Print **only** the value of the `count` field.

> **Note:** The query may contain spaces, `&`, `#`, `+`, `%`, `=` and emoji. The server reports what it understood in the `query` field, which is handy for checking your encoding.

# Example

For the response above, you should print:

```
2
```
