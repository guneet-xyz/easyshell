# Problem Statement

Your spy friend is back. Yes, the dramatic one from Backwards Day, who sent you a message with every line written backwards _and_ the lines in reverse order "for security". You decoded it in about four seconds. They took it personally.

So they went to spy school (an online course, 40% off). They studied the greats: Max and his ROT13 party invitations, Captain Shellbeard and his hex treasure maps, Gerald and his base64 postcards. Then they had an idea: why use one cipher when you can use **all of them**, stacked like a cake?

`message.txt` is the result. `recipe.txt` lists the layers in the order they were applied, one per line: the first line is the first thing done to the original message, the last line is the icing on top. Every message uses a different recipe, and some layers appear more than once, because your friend is _thorough_.

There are four kinds of layer:

| Layer    | What was done to the text                                                     |
| -------- | ----------------------------------------------------------------------------- |
| `base64` | encoded with `base64` (wrapped at 76 characters per line)                     |
| `rev`    | every line reversed with `rev` (the line order stays the same)                |
| `rot13`  | ROT13: letters rotated by 13 places with `tr`, everything else left untouched |
| `hex`    | encoded as plain lowercase hex with `xxd -p` (wrapped at 60 digits per line)  |

Eat the cake from the top down.

# Instructions

1. Read `recipe.txt` to find out which layers were applied to `message.txt`, and in which order.
2. Undo every layer, starting with the **last** one in the recipe and ending with the first.
3. Print the original message.

# Example

If `recipe.txt` contains

```
rev
base64
```

then the original message was first reversed line by line and then base64-encoded. To get it back, base64-decode `message.txt` first, then reverse every line of the result.
