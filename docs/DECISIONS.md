# Decisions

Newest at the bottom. Format: date — decision — why.
Open questions stay in the OPEN section until the user settles them.

## OPEN (need the user's answer)
1. **Platform.** Recommended: browser app (HTML + JavaScript, offline PWA,
   hosted on GitHub Pages) — works on phone and PC, matches other projects.
   Alternative: Godot (better tools for animation, worse for a phone link).
2. **Time scale.** Recommended: two clocks.
   - Day clock: 1 real minute = 1 game hour at normal speed (a day = 24 min).
   - Life clock: a game year = 28 game days (4 seasons x 7 days).
     At normal speed a year ≈ 11 real hours; toddler → school age ≈ 1.5 real days.
   - Speeds: pause, 1x, 3x, 10x, and "skip" (auto-fast while everyone sleeps).
3. **What happens when the app is closed.** Recommended: on reopen, the sim
   fast-forwards the missed time (capped, e.g. max 7 game days) and shows a
   "while you were away" summary. Later option: run the sim 24/7 on a home
   server (e.g. the Chromebox) and the phone just watches.
4. **Art style.** Recommended: top-down pixel art, one floor to start.
5. **Player control.** Recommended: watch-only, plus optional "nudges" later
   (e.g. trigger a storm, give a pay rise).

## SETTLED
- 2026-11-09 — The house is the whole visual world; outside is text only. — Keeps scope buildable.
- 2026-11-09 — Simulation code is separate from drawing code. — Needed for fast-forward/catch-up and a possible server version.
- 2026-11-09 — No paid AI required; commentary built from text templates. — User preference, no subscriptions.
