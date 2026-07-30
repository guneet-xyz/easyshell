# Problem Statement

Your CI/CD pipeline needs to know the version of your Python package. The version is set in a variable called `__version__` inside a file named `__about__.py`. The catch? You have no idea where this file is hiding! Your mission: find the file, extract the version, and print it so your pipeline can do its thing.

# Instructions

1. Search for a file named `__about__.py` somewhere in the project directory tree.

2. Once found, extract the value assigned to the `__version__` variable in that file.

3. Print only the version string (no extra text, no quotes).

# Constraints

- There will be only one `__about__.py` file in the project directory tree.

- The version will always be defined in the format `__version__ = "X.Y.Z"` (X, Y, Z are numeric values which can be of different length)

- There are no other variables or strings in the file that match this pattern.

# Example

File: `__about__.py`

```python
# My Awesome Package
__version__ = "1.0.0"
```

Output:

```
1.0.0
```
