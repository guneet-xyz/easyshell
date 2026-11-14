# Problem Statement

Captain Shellbeard has traded the high seas for the high skies. His new ship, the USS Bourne Again, is a refurbished cargo freighter with a fresh coat of paint, a skull-and-crossbones on the hull, and a ship's computer that refuses to say "arr".

Mission Control has just called: they've lost the crew list. Again. Luckily, the ship's computer keeps `manifest.txt`, a colon-separated file in the style of `/etc/passwd`. Unluckily, it's full of extra columns and the computer's own notes-to-self, and the Captain has no patience for either. "Names!" he bellows. "Just the names, ye landlubber!"

# Instructions

1. Every crew entry in `manifest.txt` is one line with four fields separated by colons:

   ```
   name:rank:home_planet:shoe_size
   ```

2. Lines that **start** with `#` are comments: skip them. A `#` anywhere else in a line is ordinary data (yes, one crew member really is called `Unit #7`).
3. Print the name (the first field) of every crew member, one per line, in the same order as the file.
4. Names may contain spaces; print them in full.

# Example

For this `manifest.txt`:

```
# crew of the USS Bourne Again
Shellbeard:captain:Earth:47
Pickles:ship's cat:Mars:2
```

you should print:

```
Shellbeard
Pickles
```
