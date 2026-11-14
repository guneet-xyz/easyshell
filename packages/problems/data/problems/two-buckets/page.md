# Problem Statement

Your boss has discovered "paper trails" and now wants one for every deploy. His requirements, written on a sticky note and slapped onto your monitor:

> GOOD NEWS IN ONE FILE. BAD NEWS IN ANOTHER FILE. I WILL READ THE GOOD ONE.

He will not read the bad one. He has been very clear about that. The bad news file exists purely so that, when something breaks, he can say "well, it was in the logs".

Luckily `./deploy.sh` already does half the work: progress messages go to **standard output**, and warnings and errors go to **standard error**. Remember Madame Shellena? Same two streams, except this time you're keeping both of them, each in its own bucket.

# Instructions

1. Run `./deploy.sh` from the current directory.
2. Save everything it prints on standard output to `deploy.out`.
3. Save everything it prints on standard error to `deploy.err`.
4. Both files must exist afterwards, even if a stream printed nothing (the file is then empty).
5. If `deploy.out` or `deploy.err` already exists from a previous deploy, replace its contents. Don't append.
6. Print nothing to the terminal, and leave every other file (including `deploy.sh`) untouched.

> **Note:** `deploy.sh` may exit with a non-zero status when the deploy goes badly. That's fine. Your job is the buckets, not the deploy.
