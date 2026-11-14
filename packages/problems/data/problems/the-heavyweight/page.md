# Problem Statement

Your boss storms over, holding a printout of a dashboard. A printout. Of a dashboard.

"Disk usage: **99%**! The server is going to explode! Find out what's eating the disk and fix it!"

The usual suspect is `storage/`: years of backups, logs, "temporary" files and folders nobody dares to open. You have a hunch there's one enormous file in there that's to blame. Before anything gets deleted, you want its name, so you can show the boss the culprit. (And no, you're not just deleting `logs/` again. You remember how that went.)

# Instructions

1. Find the **largest regular file** (by size in bytes) anywhere under `storage/`, at any depth.
2. Print its path, starting with `storage/`, for example `storage/backups/db.sql`. Print nothing else.
3. Hidden files and files inside hidden folders (names starting with a `.`) count too.
4. File and folder names may contain spaces.
5. Only files count, not folders, and there's always exactly one largest file.
