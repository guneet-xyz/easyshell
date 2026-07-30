# Problem Statement

Your Twitter clone’s backend is a treasure trove of data. Fetch the most recent post from the API and display it's content in the shell.

# Instructions

1. Fetch the most recent post from `http://localhost:4000/most-recent-post` using a `GET` request.
2. Display only the content of the post in the shell.

# Example

A sample response from the API is as follows:

```json
{
  "id": 1,
  "content": "The weather is great today!",
  "author": "Alice"
}
```

For this post, you should display

```
The weather is great today!
```
