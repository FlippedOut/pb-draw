# Project Requirements — Pickleball Draw

## Product Goal
Generate fair, printable, multi-round doubles draws from a pasted registration list, with tooling to confirm/lock pairs and manage byes & courts.

## Non-negotiables (always true)
- **Fairness**: balance skill across matches and rounds; avoid repeats when possible.
- **Locked pairs**: if two players are confirmed/locked, they must play together in every round **except** when either is on a bye.
- **Singles stay single**: unpaired players remain flexible; they are *not* permanently paired unless explicitly locked.
- **No double-assignment**: a player appears **once per round** (either in a match or on bye).
- **Print-ready**: rounds render with court numbers; print view hides controls & keeps page breaks.

## Configurable Inputs (defaults)
- **Courts**: default `11` (UI lets user change and choose starting court).
- **Rounds**: default `8` (UI lets user change).
- **Points/To score**: default `11` (engine param; used for labels only today).

## Court Numbering
- Courts render sequentially from **Starting Court** (e.g., start=3 means 3,4,5… then wrap only if explicitly configured).

## Bye Policy (priority order)
1) **Singles who have had 0 byes** (highest priority).
2) **Then** locked pairs (both off together **only if** needed to fill two bye slots; otherwise one off is allowed).
3) Only after **everyone** has one bye may a **second** bye be assigned.
4) Continue rotation fairly across further rounds.

## Pairing Rules (round generation)
- Use **locked pairs** first (keep them together each playable round).
- Gender category is mandatory when feasible: schedule like-vs-like first — male-pair vs male-pair, female-pair vs female-pair, mixed-pair vs mixed-pair. Do not schedule cross-category (e.g., male-pair vs female-pair, mixed vs male-only/female-only) unless there are not enough players to fill courts.
- Fill remaining slots with singles, optimizing for:  
  a) skill balance per match;  
  b) avoid repeat opponents across rounds when feasible;  
  c) respect gender categories as above.
- If an odd number of singles exists for a round, assign byes per bye policy.

## Intake / Partner Suggestions (UI behaviour)
- Detect **Mutual** preferences (both selected each other) → High confidence (green).
- Detect **One-way** preferences → Medium confidence (amber).
- **Skill-based suggestions** only for remaining singles → Low/medium confidence (grey).
- "Confirm all" accepts current suggestion list; user can remove individual suggestions.
- After confirmation, **persist** locks as `lockedPartner/fixedPartnerId/partnerId`.

## Definition of Done (DoD) per feature
- Unit tests pass for the feature's core logic.
- Round summary shows unique player assignment per round.
- With sufficient players, no male-pair vs female-pair matchups occur; repeat opponents are avoided until constraints force otherwise.
- Byes satisfy the policy above in multi-round simulation.
- Print preview is readable with page breaks.