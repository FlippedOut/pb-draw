# Delivery Ruleset (Guardrails)

## Process
- **Test-driven steps**: For each engine change, add/adjust unit tests, then code, then re-run tests.
- **No drift**: PRs must reference `docs/requirements.md` and state which clauses they satisfy.
- **Status checks required**: CI build+tests must be green before merge.

## Quality Gates
- Lint (basic), Build, Unit tests (Vitest), Simple multi-round simulation sanity check.

## Branching
- `main`: stable, production only (Vercel).
- `ai-dev`: working branch for feature PRs / preview deploys.

## PR Template Enforcement
- Use `.github/PULL_REQUEST_TEMPLATE.md` (added below).