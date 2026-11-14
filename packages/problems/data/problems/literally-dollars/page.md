# Problem Statement

Your startup has 14 employees, 0 customers and a payroll process that is, technically, a shell script. Your boss wants a fresh copy of `pay-day.sh` in the home folder, and since you never leave the terminal, you'll write it from the terminal.

You've tried this before. You `echo`ed the script into a file, and the shell "helpfully" expanded everything on the way in. `$USER` became `root`. `$(date +%A)` became `Thursday`, forever. `$1,000,000` became `,000,000`, which the bank did not appreciate. And Grandma's `$5` cut vanished completely. She noticed. She always notices.

This time, the dollars stay dollars. Every single character goes into the file exactly as written.

# Instructions

1. Create a file named `pay-day.sh` in the current directory with **exactly** this content:

   ```sh
   #!/bin/sh
   # pay-day.sh: pays whoever runs it. What could possibly go wrong?
   echo "Paying $USER on $(date +%A)..."
   echo "Signed off by: `whoami`"
   printf 'Amount: $1,000,000\nStatus: "definitely pending"\n'
   echo "Grandma's cut: \$5 (she insisted)"
   ```

2. The file must match byte for byte: every `$`, backtick, backslash, quote and space stays exactly as shown. The file has exactly 6 lines, and every line ends with a newline, including the last one.
3. If `pay-day.sh` already exists, replace it completely.
4. Leave every other file untouched.

> **Note:** You don't need to make the script executable, and please don't run it. It pays whoever runs it.
