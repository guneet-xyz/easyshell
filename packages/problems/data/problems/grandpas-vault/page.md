# Problem Statement

You know Grandma, legendary keeper of the secret cookie recipe. Meet **Grandpa**. At 82, Grandpa decided that "the cloud" was a fad and that he would host the family treasure map himself, on a web server he wrote in a weekend.

He protected it with **HTTP Basic Authentication**, which he describes as "military grade". Then, so he wouldn't forget the password, he saved the credentials in a file called `creds.txt` on the desktop. Security!

The whole family has been trying to get in since Thanksgiving. Grandpa says whoever opens the vault first gets to keep the treasure (and has to fix his printer). Let's go.

# Instructions

1. `creds.txt` contains the credentials on a single line in the form `username:password`, followed by a newline. The newline is not part of the credentials.
2. Only the **first** `:` separates the username from the password. The password itself may contain `:`, spaces and other special characters.
3. Send a `GET` request to `http://localhost:4000/vault`, authenticating with HTTP Basic auth using these credentials.
4. If the credentials are right, the vault responds with:

   ```json
   {
     "treasure": "Under the third garden gnome from the left",
     "message": "Welcome, family member. Don't tell your cousins."
   }
   ```

   Without (correct) credentials, it answers with status `401` and `"treasure": null`.

5. Print **only** the value of the `treasure` field, without quotes.

# Example

For the response above, you should print:

```
Under the third garden gnome from the left
```
