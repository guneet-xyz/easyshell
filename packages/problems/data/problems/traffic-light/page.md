# Problem Statement

To save money, the city replaced the traffic light controller at its busiest junction with a shell script. The intern who wrote it has since quit to "pursue a career in vibe coding", and the script now consists of a single comment: `# TODO: the rest`.

The good news: the hardware still works. Every time the light changes, its colour is written to `light.txt`. The bad news: the drivers below have no idea what that means, and they're getting creative. Tell them what to do before somebody turns the junction into a demolition derby.

# Instructions

1. `light.txt` contains a single line with the light's colour.
2. Print exactly one line, depending on the colour:

   | `light.txt`   | Print             |
   | ------------- | ----------------- |
   | `red`         | `STOP`            |
   | `yellow`      | `SLOW DOWN`       |
   | `green`       | `GO`              |
   | anything else | `CALL A MECHANIC` |

3. Colours are case-sensitive: only these exact lowercase words count. `Red`, `GREEN` and `purple` all need a mechanic.
