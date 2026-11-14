# Problem Statement

Your friend is a spy. Probably. Nobody has ever confirmed it, but they wear sunglasses indoors, call you "Agent", and once spent an entire dinner whispering because "the walls have ears".

This morning they sent you a file called `doll.tar.gz` with the message: _"Intel inside. Wrapped it in a few layers of security. Trust no one. Not even gzip."_

You unpack it. Inside is a zip. Inside the zip is a `.bz2`. Inside _that_ is a tarball, and inside the tarball... you get the idea. Somewhere at the very bottom is `secret.txt`. You could peel it by hand, but your friend has a habit of sending these every week, and every doll is wrapped differently. Time to build a machine that peels dolls.

# Instructions

1. You start with a single file, `doll.tar.gz`, in the current directory.
2. Keep unpacking layers until you reach `secret.txt`, then print its contents. Print **only** the contents of `secret.txt` (careful with commands that chat about what they're doing).
3. You can tell how a layer is packed from the **end** of its name:

   - `.tar`: a tar archive containing exactly one file, the next layer.
   - `.zip`: a zip archive containing exactly one file, the next layer.
   - `.gz`, `.bz2` or `.xz`: a single compressed file. Decompressing `name.gz` gives you `name`.
   - `.tar.gz`, `.tar.bz2` or `.tar.xz`: a compressed tar archive. Unpack it in one go, or decompress it and then untar it.

   Only the end counts: `notes.zip.gz` is a gzipped zip, and `notes.tar.xz.bz2` is a bzip2-compressed `notes.tar.xz`.

4. The archives contain no folders, and no name contains spaces.
5. The number of layers, their order and the names of every layer except `doll.tar.gz` and `secret.txt` change from doll to doll. Your solution must work for any of them.
