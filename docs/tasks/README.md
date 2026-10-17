# Agent task prompts

Give the agent ONE task at a time, plus `AGENTS.md`. Do not paste the long design discussion.
Each task has a "done when" you can verify yourself. Review diffs to protected files by hand.

Order matters:

1. `01-fuzz-test-ops.md`: lock down the reducer before anything builds on it.
2. `02-render-frame.md`: preview/export parity foundation.
3. `03-retrieval-query.md`: first real matching baseline, measured on the golden set.

Task 3 needs a seeded library and real golden labels. With only `evals/golden/sample.jsonl` the
harness runs but the numbers mean nothing.
