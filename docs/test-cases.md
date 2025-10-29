# Test Cases (Executable intent)

## TC-01: No duplicate assignment per round
- Given 16 players, 8 courts, 2 rounds
- When generating a draw
- Then each player appears at most once in Round 1 and at most once in Round 2.

## TC-02: Bye priority order
- Given 18 players, 8 courts (room for 16 per round), singles+locked pairs mix
- When generating 4 rounds
- Then: (1) every single gets a bye before any pair member gets one; (2) after all have 1 bye, second byes start.

## TC-03: Locked pairs persist around byes
- Given a locked pair (A,B)
- When A is on a bye in Round r
- Then in Round r+1, A and B are reunited (unless B is on bye), i.e., they do not stay broken.

## TC-04: One-way vs mutual detection
- For players with preference fields, Mutual pairs flagged as high-confidence; One-way as medium; others as skill-based.

## TC-05: Court numbering from starting court
- Given starting court = 3 and 5 courts used
- Then rendered courts are 3,4,5,6,7 (no re-use of 1–2 unless configured).

## TC-06: Gender category enforcement when feasible
- Given enough male-only pairs, female-only pairs, and mixed pairs to fill courts
- When generating a draw
- Then matches are like-vs-like by category: male-pair vs male-pair, female-pair vs female-pair, and mixed-pair vs mixed-pair only.

## TC-07: Opponent uniqueness until constrained
- Given sufficient opponents across early rounds
- When generating 3 rounds
- Then each player's opponent set contains unique players across rounds (no repeats) unless court/player capacity forces otherwise.