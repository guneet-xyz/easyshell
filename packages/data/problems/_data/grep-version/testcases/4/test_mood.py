"""
test_mood.py - Tests for moodring's mood detection.

All tests were written by an AI in a surprisingly good mood.
"""

from moodring import detect_mood


def test_happy_mood():
    assert detect_mood("I love Python!") == "ecstatic"


def test_grumpy_mood():
    assert detect_mood("This bug is so annoying...") == "grumpy"


def test_neutral_mood():
    assert detect_mood("Just writing some code.") == "neutral"
