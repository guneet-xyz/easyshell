# Problem Statement

Remember that last task where you made a POST request to your Twitter clone? You sent data with an `author` key but didn’t bother using proper authorization. Well, your boss wasn’t thrilled about your laissez-faire approach to security. Now, you’ve been tasked with fixing it up and doing it the right way — using bearer tokens. After some heated feedback (a.k.a. yelling), the backend engineer updated the API to require bearer tokens for all requests.

The bearer token for authorization is provided to you in the `token.txt` file (I know, excellent security!). Once the request is successful, the API will return an `id` for the new post. Your job is to extract this id and print it out.

# Instructions

1. Read the bearer token from the `token.txt` file.

2. Make a `POST` request to `http://localhost:4000` on the `/new-post` endpoint.

3. The request body should be as such:

   ```json
   {
     "content": "Easyshell is a great platform"
   }
   ```

4. Include the bearer token in the Authorization header using the format:

   ```
   Authorization: Bearer <token>
   ```

5. The server will respond with a response as such:

   ```json
   {
     "status": "success",
     "message": "Post created successfully",
     "post_id": <post id>
   }
   ```

6. Display the `post_id` in the console.

> **Note:** make only one post, your output should the output of the first post you make.
