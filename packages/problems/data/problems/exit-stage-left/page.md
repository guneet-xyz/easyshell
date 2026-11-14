# Problem Statement

Every Friday, your boss decides whether this week's release goes out. He has a flair for the dramatic, so he writes his verdict into `verdict.txt`, dims the office lights and waits for applause.

The CI pipeline doesn't applaud. The CI pipeline is very powerful and completely illiterate. It doesn't read text files and it doesn't care about drama. It understands exactly one thing: the **exit status** of the last command. `0` means "everything is fine, ship it". Anything else means "stop the show".

Last week someone wrote a translator that printed the right message and then exited with `0` no matter what. The pipeline shipped a release your boss had blocked in capital letters. Be a better translator.

# Instructions

1. `verdict.txt` contains a single line.
2. If that line is exactly `ship it` (all lowercase, nothing before or after it), print `🚀 shipping` and exit with status `0`.
3. Otherwise, print `🛑 blocked` and exit with status `1`.
4. The match is exact and case-sensitive: `SHIP IT`, `ship it later` and `please don't ship it` all mean blocked.

> **Note:** Your submission runs as a script, so `exit` ends the script with that status. In the interactive terminal, `exit` closes your shell instead. To try things out there, put your commands in a file and run it with `sh my-script.sh; echo $?`.
