# Problem Statement

Your friend Dave works in accounting. Your friend Dave is also, in his own words, "a deep-cover operative for an agency so secret it doesn't have a name". Dave sends you missions. You have stopped asking questions.

Today's mission arrived as `mission.env`: a file full of `KEY=value` lines, exactly the way shell variables are written. A real agent doesn't open the file, squint at it and copy the values by hand. A real agent loads the variables straight into the shell and delivers the briefing like a professional. Dave will be watching. (He won't. He's at lunch.)

# Instructions

1. `mission.env` is a valid shell script made of variable assignments. It defines at least `AGENT`, `TARGET` and `DEADLINE`, and it may also contain comments, blank lines and other variables.
2. Load the variables from `mission.env` into your shell.
3. Print exactly this one line, with each placeholder replaced by the value of that variable:

   ```
   Agent <AGENT>, your target is <TARGET>. You have until <DEADLINE>.
   ```

4. Values may be wrapped in quotes in the file and may contain spaces. Print the value itself, without the quotes: `TARGET="the Golden Rubber Duck"` means the target is `the Golden Rubber Duck`.

# Example

With this `mission.env`:

```sh
AGENT=Nightshade
TARGET=Kevin
DEADLINE=midnight
```

the briefing is:

```
Agent Nightshade, your target is Kevin. You have until midnight.
```

> **Note:** This message will not self-destruct. Dave still hasn't figured out how to do that.
