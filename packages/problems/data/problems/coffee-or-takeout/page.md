# Problem Statement

Your smart kitchen is controlled entirely by shell scripts. Your friends call this "a cry for help". You call it "automation".

Every morning goes the same way. `./boil-water.sh` boils the water, except when the kettle isn't feeling it. Then `./brew-coffee.sh` makes the coffee. The coffee machine must **never** run on cold water. That's how the Incident of Last Tuesday happened, and nobody in the household is allowed to talk about it.

If anything goes wrong at any point, you're not going to fight your appliances before caffeine. You give up and order takeout.

# Instructions

1. Run `./boil-water.sh`.
2. Run `./brew-coffee.sh` only if `./boil-water.sh` succeeded.
3. If `./boil-water.sh` failed, or `./brew-coffee.sh` failed, print exactly:

   ```
   Ordering takeout 🍜
   ```

4. If both succeeded, don't print the takeout line.
5. Let the output of the scripts through unchanged. Don't hide or redirect it.

> **Note:** A script _succeeds_ when it exits with status `0` and _fails_ with any other status. Both scripts print what they're doing, so if the coffee machine runs when it shouldn't, everyone will know.

> **Bonus:** the whole morning routine fits on a single line. Your kitchen deserves elegance.
