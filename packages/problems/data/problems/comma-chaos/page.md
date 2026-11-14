# Problem Statement

Your cousin's band, **Segfault & the Core Dumps**, is going on tour, and you've been "promoted" to tour manager (unpaid, but you get a free T-shirt). The booking agent sent over every venue they could find in `venues.csv`, and the band wants to know how many shows they can play in Portland.

Portland, **Oregon**. Last year the drummer booked the whole tour in Portland, Maine. The band played to eleven people and a lobster. Nobody is allowed to talk about it.

The file looks innocent enough:

```csv
name,city,capacity,notes
Doug Fir Lounge,"Portland, OR",300,great sound
"Rock & Roll Hall, Main Stage","Portland, OR",1200,"the big one"
Neumos,"Seattle, WA",650,"two hours from Portland, OR"
```

Then you notice the commas. Commas in the names. Commas in the cities. Commas in the notes. Every `cut -d,` you try returns gibberish, and every `grep` counts venues that are merely _near_ Portland. Chaos.

# Instructions

1. `venues.csv` has a header row (`name,city,capacity,notes`), then one venue per line.
2. Any field may be wrapped in double quotes. A quoted field can contain commas, but it never contains double quotes or line breaks. The quotes are not part of the value.
3. Count the venues whose `city` (the **second** field) is exactly `Portland, OR`. Other cities don't count, even if they look similar (`Portland, ME`, `Portland`, `Portland OR`), and neither do mentions of `Portland, OR` in any other field.
4. Print the count as a single number.

# Example

For the file above, the output is:

```
2
```

`Neumos` is in Seattle, no matter how Portland-ish its notes are.
