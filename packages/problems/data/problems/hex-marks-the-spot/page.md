# Problem Statement

Captain Shellbeard is back. Yes, the one with the twelve-levels-deep JSON treasure map. After you summed up all his gold, he decided his secrets needed better protection, so he fired his cartographer, bought a laptop, and saved his new map as **hexadecimal**.

"No landlubber can read hex!", he roars, tapping `map.hex` with his hook. Every character of the directions was turned into two hex digits: `A` became `41`, a space became `20`, and a line break became `0a`. The Captain then printed it all out, wrapped it in oilcloth, and buried the _decoder_ separately. Classic Shellbeard.

You don't need the decoder. You have a shell.

# Instructions

1. `map.hex` contains the directions as plain hexadecimal digits: two digits per byte, nothing else (no addresses, no `0x` prefixes).
2. The digits may be lowercase (`0a`) or uppercase (`0A`).
3. The digits are wrapped across several lines of at most 60 digits. Those line breaks are not part of the message, and they never split a byte in half. Line breaks _inside_ the message are encoded as `0a`, like any other character.
4. Convert the hex back into text and print the directions exactly.

# Example

If `map.hex` contains

```
57616c6b2031302070616365732e0a
```

you should print

```
Walk 10 paces.
```
