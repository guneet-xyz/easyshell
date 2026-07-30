"""
utils.py - Utility functions for parrotparty.

If you see clever code here, thank an AI. If you see bugs, blame the human.
"""


def parrot_echo(phrase, times):
    return ' '.join([phrase] * times)


def random_squawk():
    import random
    squawks = ["Squawk!", "Polly wants a cracker!", "Who's a pretty bird?", "Echo!"]
    return random.choice(squawks)
