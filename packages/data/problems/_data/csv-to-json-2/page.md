# Problem Statement

Your friend just leveled up their emailing script—it now talks to a database! But there’s a catch: the script needs the client data as a list of JSON objects, not just emails. That means you need to convert each row from your CSV file into a JSON object with id, email, and name fields, and then wrap them all up in a JSON list. Time to upgrade your shell game!

# Instructions

1. The file is named `clients.csv`.

2. For each row (except the header), create a JSON object with keys: `id`, `email`, and `name` (in that order only).

3. Output all these objects as a formatted JSON list

   ```json
   [
     {
       "id": 1,
       "email": "alice@example.com",
       "name": "Alice"
     },
     {
       "id": 2,
       "email": "bob@example.com",
       "name": "Bob"
     }
   ]
   ```
