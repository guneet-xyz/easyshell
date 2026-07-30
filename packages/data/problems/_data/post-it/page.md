# Problem Statement

Good job on fetching the most recent post! Now, let's make a post of our own.

# Instructions

1. Make a `POST` request on `http://localhost:4000` at the `/new-post` route.
2. The post body should be a JSON object as such:

   ```json
   {
     "content": "Easyshell is a great platform",
     "author": "Alice"
   }
   ```

3. The server will respond with a response as such:

   ```json
   {
     "status": "success",
     "message": "Post created successfully",
     "post_id": 1251
   }
   ```

4. Display the `post_id` in the shell. As such

   ```stdout
   1251
   ```

> **Note:** make only one post, your output should the output of the first post you make.
