# Problem Statement

The shared team server is full. Again. Builds are failing, the intern's Minecraft server has crashed (wait, what?), and someone has posted "who is using all the disk???" in the team chat for the third time this week.

Every teammate has a folder in `home-dirs/`. One of them has been hoarding. It's time to find out who, and post their name in the chat for everyone to see. Name and shame.

(Spoiler: it's usually the intern. But not always. Sometimes it's someone who has been very insistent that "we all need to cut down on disk usage".)

# Instructions

1. `home-dirs/` contains one folder per teammate.
2. Work out how much space each teammate uses: the total size of **all** the files in their folder, at any depth, including hidden files and files in hidden folders.
3. Print the **name** of the folder with the largest total (for example `intern`, not `home-dirs/intern/`).
4. A lot of small files can add up to more than one big file.
5. There's always exactly one hog, and it wins by a wide margin: measuring with `du`, which counts disk blocks rather than bytes, gives the same answer.
