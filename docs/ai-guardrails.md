# AI Guardrails Prompt (paste/link this into model sessions)

- Always read `docs/requirements.md` and `docs/ruleset.md` first.
- When changing the match engine, write unit tests in `src/__tests__` first.
- Preserve locked pairs across rounds except when a member is on a bye. Reunite them next playable round.
- Apply bye policy exactly as specified.
- Never assign a player twice in one round.
- In PR descriptions, cite which requirement bullets are satisfied.

How this helps immediately:

- Every change now refers back to the requirements.
- CI guarantees we don't ship obvious regressions.
- The bye/locking/court rules are codified (we'll extend tests to match your exact policies).
- You and I can iterate by updating these docs first, then code—so the model doesn't "forget".