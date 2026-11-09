# CLAUDE.md — Working rules for the Family Simulator

This file is read at the start of every session. The repository files are the
source of truth — not chat history.

## Start of every session
1. Read `docs/STATUS.md` (where we are, what's next) — always.
2. Read `docs/DECISIONS.md` (what's settled, what's still open) — always.
3. Read only the other docs the task touches:
   - `docs/VISION.md` — what the project is and isn't
   - `docs/ROADMAP.md` — phases and checklists
   - `docs/ARCHITECTURE.md` — code layout, tick loop, save format
   - `docs/SIMULATION.md` — how people, needs, emotions, time, life, economy work
   - `docs/FAMILY.md` — the starting family
4. Confirm with the user what this session is for before writing code.

## End of every session (non-negotiable)
1. Update `docs/STATUS.md`: current phase, what was done, what's next, known bugs.
2. Add any new decision to `docs/DECISIONS.md` (dated, with the reason).
3. Tick finished items in `docs/ROADMAP.md`.
4. If the design changed, update `SIMULATION.md` / `ARCHITECTURE.md` to match.
5. Commit with a clear message.

## Rules
- No code is written until the user approves the step.
- The simulation never depends on the renderer. `src/sim/` must run with no
  screen at all (so it can fast-forward, catch up, or run on a server).
- Same seed + same inputs = same result (seeded random only, never Math.random()).
- Content (actions, jobs, text lines, house layout) lives in `data/`, not code.
- Small steps. Every phase ends with something the user can open and watch.
- Phone-first: everything must work on a phone screen.
- No paid AI services or subscriptions are required to run it.
- Explain steps and terms fully when giving setup instructions.
