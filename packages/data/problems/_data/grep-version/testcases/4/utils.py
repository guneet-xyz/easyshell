"""
utils.py - Utility functions for moodring.

If this code feels a little too cheerful, blame the AI.
"""


def mood_score(text):
    happy = ["love", "great", "awesome", "yay"]
    grumpy = ["bug", "fail", "broken", "ugh"]
    score = 0
    for word in happy:
        score += text.lower().count(word)
    for word in grumpy:
        score -= text.lower().count(word)
    return score


def random_mood():
    import random
    return random.choice(["ecstatic", "meh", "grumpy", "zen"])
