# Problem Statement

It's 2 a.m. and your Twitter clone can't connect to its database. The logs say `connection refused`, which is the database's way of saying "you have the wrong port, genius".

The port is in `config.ini`. So is every other port. Every team that ever touched the app added their own section, and every single one of them picked a `port`: `[server]`, `[cache]`, `[metrics]`, the "temporary" `[database_replica]` from 2022... Somewhere in there is the one that matters.

```ini
; Chirp config. DO NOT TOUCH. - Steve

[server]
host = 0.0.0.0
port = 4000

[database]
host = db.internal
port = 5432
```

You put on your detective hat. It's a very nice hat.

# Instructions

1. The config file is `config.ini`.
2. Print the value of the `port` key in the `[database]` section, and nothing else.
3. A section starts at a line like `[database]` and runs until the next section header (or the end of the file). The section name must match exactly: `[database_replica]` or `[database-old]` are different sections. Lines before the first section header don't belong to any section.
4. Keys and values are written as `key = value`. There may be any number of spaces around the `=` (including none), and they are not part of the key or the value.
5. The key must be exactly `port`: keys like `port_admin` or `replica_port` don't count.
6. Lines that start with `;` are comments, even if they look like `;port = 1234`. Ignore them.
7. Section headers, keys and comments always start at the beginning of the line. The `[database]` section contains exactly one (uncommented) `port` key.

# Example

For the `config.ini` above, the output is:

```
5432
```
