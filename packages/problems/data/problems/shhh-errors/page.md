# Problem Statement

You've found `fortune-teller.sh`, a script run by the mysterious Madame Shellena. Her fortunes are genuinely excellent. The problem is that Madame Shellena also complains. Constantly. About the dust on her crystal ball, about Mercury being in retrograde, about the spirits taking a lunch break.

Luckily, Madame Shellena is a professional. She says her fortunes on **standard output** and does all her complaining on **standard error**. In your terminal both streams end up on the same screen, so it all looks like one big rant. But they are two separate streams, and you can treat them differently.

Keep the fortunes. Silence the drama.

# Instructions

1. Run `./fortune-teller.sh` from the current directory.
2. Everything the script prints on standard output must appear, unchanged and in the same order.
3. Nothing may be printed on standard error.

> **Note:** Don't try to filter the complaints by their text. Some of Madame Shellena's fortunes mention `WARNING`, and some of her complaints look exactly like fortunes. The only reliable difference is the stream they're printed on.
