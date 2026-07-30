# Problem Statement

Good job on writing that script! Your team is very happy and the CI/CD pipeline is working like a charm now. Things were going great until one day, a new developer joined the team and immediately broke the pipeline.

You investigate and you find that it was your script where the error occurred! You quickly check the commit history and discover the following

File: `__about__.py`

```python
# __version__ = "1.0.0"
__version__ = "1.0.1"
```

The new developer added a comment to the line where the version is defined. This caused your script to fail because it extracted the wrong version string.

You quickly make a patch to the `__about__.py` file to fix the issue, but you realize that this is not a sustainable solution. You need to make your script more robust so that it can handle such cases in the future.

# Instructions

Your objective remains the same;

1. Search for a file named `__about__.py` somewhere in the project directory tree.

2. Once found, extract the value assigned to the `__version__` variable in that file.

3. Print only the version string (no extra text, no quotes).

# Constraints

After this debacle, you decide to add some constraints to your script to make it more robust. The following are the updated constraints:

- There will be only one `__about__.py` file in the project directory tree.

- The version will always be declared in the variable called `__version__`.

- The `__version__` variable will not be declared in any other file.

- The `__version__` variable will always be a string and declared using literals and not using any other method (e.g., `__version__ = str("1.0.0")`).

- The `__version__` variable could occur in comments or in strings. You need to ignore these occurrences.

- The `__version__` variable could be re-assigned later on in the `__about__.py` file. In this case, the last assigned value must be extracted.

- The `__version__` variable could be assigned within a `if __name__ == "__main__":` block. So don't rely on indentation to find the correct declaration.

- Your project does not make use of any multi-line strings (`"""` or `'''`) so you don't have to worry about `__version__` being declared in multi-line strings.

- The version can follow any format, example - `"1.0.0"`, `1.0.0`, `1.0.0-alpha`, `1.0.0-rc.1`, `1.0.0+build.1`, `1.0.0-alpha+001`, etc.

# Example

File: `__about__.py`

```python
# Commented __version__ = '1.0.2'
"__version__ = '1.0.3'"
'__version__ = "1.0.4"'
__version__ = "1.0.4"
if __name__ == "__main__":
    __version__ = "1.0.5"
    # __version__ = "1.0.6"
    print(__version__)
```

Output:

```
1.0.5
```
