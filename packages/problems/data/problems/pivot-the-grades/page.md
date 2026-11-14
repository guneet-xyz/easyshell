# Problem Statement

Grandma has retired from retirement. She now runs an evening cooking class at the community centre, and she takes grading **very** seriously. (Kevin signed up. Nobody knows why. Grandma says he "has potential". Grandma is wrong.)

The community centre's grading system exports every score as a long list in `scores.csv`, one line per student and subject:

```csv
student,subject,score
Priya,Soups,88
Dave,Soups,41
Priya,Baking,95
Dave,Baking,58
Priya,Knife Skills,79
```

Grandma has looked at this list through her reading glasses, then through her other reading glasses, and has declared it "useless". She wants a proper table, with one row per student and one column per subject, like the paper ledger she's used since 1974.

# Instructions

1. `scores.csv` has a header row, then lines of `student,subject,score`. Fields never contain commas. Each student/subject pair appears at most once, and the lines can be in any order.
2. Print a CSV table. The first line is the header: `student`, followed by every subject that appears in the file, sorted alphabetically.
3. Then print one line per student, sorted alphabetically: the student's name, followed by their score in each subject, in the same order as the header.
4. If a student has no score for a subject, print `-` in that column. A score of `0` is still a score (sorry, Kevin), so print it as `0`.
5. Fields are separated by commas, with no spaces around them. Print the scores exactly as they appear in the file.

# Example

For the `scores.csv` above, the output is:

```csv
student,Baking,Knife Skills,Soups
Dave,58,-,41
Priya,95,79,88
```

Dave skipped Knife Skills. Grandma has noted it in the ledger.
