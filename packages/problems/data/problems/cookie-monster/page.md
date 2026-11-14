# Problem Statement

Your Twitter clone now has an **admin dashboard**, and unlike the rest of the API, it doesn't use bearer tokens. The backend dev read a blog post from 2009 and went with **session cookies**.

Here's how it works: you log in with a username and a password, and the server hands you a cookie named `session`. Every request you make afterwards has to carry that cookie, or the dashboard pretends it has never met you.

The session ID is random and changes every time you log in, so you can't just copy one from a coworker (or from the hints). You'll need to log in, keep the cookie somewhere safe, and show it to the dashboard.

Me want cookie. Me _need_ cookie.

# Instructions

1. `login.txt` contains two lines: the **username** on the first line and the **password** on the second.
2. Log in by sending a `POST` request to `http://localhost:4000/login` with the form fields `username` and `password`. Values must be form-encoded: the password may contain spaces and characters like `&`, `=`, `+` and `%`.
3. A successful login responds with status `200` and sets a cookie named `session` (with the `Set-Cookie` response header).
4. Send a `GET` request to `http://localhost:4000/dashboard` with that cookie. It responds with:

   ```json
   {
     "welcome": "Welcome back, admin! You have 3 new followers and 0 new friends.",
     "message": "Om nom nom. Cookie accepted."
   }
   ```

   Without a valid session cookie, it answers with status `401` and `"welcome": null`.

5. Print **only** the value of the `welcome` field, without quotes.

# Example

For the response above, you should print:

```
Welcome back, admin! You have 3 new followers and 0 new friends.
```
