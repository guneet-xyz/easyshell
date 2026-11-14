# Problem Statement

Something is wrong with your project. Files keep appearing that have... nothing in them. `TODO.txt`: empty. `final.log`: empty. `untitled`, `untitled 2`, `untitled 3`: empty, empty, empty. They have names, they take up space in every listing, but there's nothing inside. Your project is **haunted**.

(The intern swears it wasn't them. The intern also has a shell history full of `touch` commands. We'll get back to that.)

Time for an exorcism. Banish every ghost, but be careful: a file holding nothing but a single newline isn't a ghost. It's just very shy.

# Instructions

1. Delete every **empty** regular file (exactly 0 bytes) in the current directory and all its subdirectories, at any depth.
2. Hidden files (names starting with a `.`) and files inside hidden folders count too.
3. Leave every non-empty file alone, even if it only contains a single space or newline, and even if it's called `empty.txt`.
4. File and folder names may contain spaces.
5. Don't delete any folders, even the ones that end up empty.
