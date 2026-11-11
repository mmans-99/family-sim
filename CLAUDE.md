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
   - `docs/FAMILY.md` — the starting family, home, mortgage and bills
   - `docs/LIFE_SYSTEMS.md` — the build guide for making the world life-like (calendar,
     stock engine, beliefs, households, jobs, economy, institutions, health). Its section 1
     rules apply to all new `src/sim/` code. Read it before building any step L0–L16.
   - `docs/WORLD_PRINCIPLES.md` — the design brief behind LIFE_SYSTEMS.md (the why).
   - `docs/HOUSE_VIEW.md` — how the house view is drawn, how to pick sprites,
     how to check it, and the mistakes to avoid. **Read it in full before
     changing anything in `src/render/`, `data/house.json` or `assets/`.**
4. Confirm with the user what this session is for before writing code.

## After every change (non-negotiable)
Every time code, data or a decision changes, before replying to the user:
1. Update `docs/STATUS.md`: what was just done, what's next, known issues.
2. Add any new decision to `docs/DECISIONS.md` (dated, with the reason).
3. Tick finished items in `docs/ROADMAP.md`.
4. If the design or code layout changed, update `docs/ARCHITECTURE.md`
   and `docs/SIMULATION.md` to match.
5. If family, home, money or bill facts changed, update `docs/FAMILY.md`.
6. Commit and push to GitHub, with a clear message.
7. Copy the changed docs to the Project so the claude.ai copy matches.

Do not leave a change without its docs updated, even a small one.

## Rules
- Work on `main` and push to `main`. Do not create branches (or PRs) unless the user asks for one by name.
- No code is written until the user approves the step.
- The simulation never depends on the renderer. `src/sim/` must run with no
  screen at all (so it can fast-forward, catch up, or run on a server).
- Same seed + same inputs = same result (seeded random only, never Math.random()).
- Content (actions, jobs, text lines, house layout, furniture) lives in `data/`, not code.
- Small steps. Every phase ends with something the user can open and watch.
- Phone-first: everything must work on a phone screen.
- No paid AI services or subscriptions are required to run it.
- Explain steps and terms fully when giving setup instructions.
- Never say a visual change works until you have taken a screenshot of every
  floor and looked at it (steps in `docs/HOUSE_VIEW.md`).
- Camera and view controls are for looking only. The player never changes
  what the family does.
