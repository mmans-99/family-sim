# Decisions

Newest at the bottom. Format: date — decision — why.

## SETTLED
- 2026-11-09 — The house is the whole visual world; outside is text only. — Keeps scope buildable.
- 2026-11-09 — Simulation code is separate from drawing code. — Needed for catch-up and for a future always-on version.
- 2026-11-09 — No paid AI required; commentary built from text templates. — User preference, no subscriptions.
- 2026-11-09 — Platform: web app (HTML + JavaScript), hosted on GitHub Pages from the public repo `mmans-99/family-sim`. — User choice. Pages works because the repo is public.
- 2026-11-09 — Time (first pass): 1 game hour = 2.5 real minutes, game year ≈ 28 real hours. — Superseded the same day by the entry below.
- 2026-11-09 — Time (current): both clocks run 2.5x slower than the first pass. 1 game hour = 6.25 real minutes. 1 game day = 2.5 real hours. 1 game year (28 game days) = 70 real hours (about 3 real days). Speeds: pause, 1x, 2x, 4x, and skip. — User asked for both clocks to be 2.5x longer so nothing is missed.
- 2026-11-09 — When the app is closed, the sim is not paused. On reopen, it catches up all missed time from the saved state and shows a "while you were away" summary. — User wants the family to keep living without a server.
- 2026-11-09 — Art style: isometric pixel art. House is a UK 3-bed semi-detached with two floors plus a back garden. — User choice.
- 2026-11-09 — Player control: watch only. No controls over the family. The player can view status, health, mood, money and history, but cannot change anything. — User choice.
- 2026-11-09 — The family lives in an urban UK city. Dad is a WFH software engineer on £70-80k. Mum is a stay-at-home mum. They have a mortgage and average UK bills. — User choice.
- 2026-11-09 — The world must feel life-like and keep evolving over time (ongoing events, ageing, economy, seasons), not reset or repeat. — User choice.
- 2026-11-09 — City: Birmingham (West Midlands). — User choice; the city is a single setting, so it's easy to change later.
- 2026-11-09 — Family names kept as proposed: Dad Tom, Mum Sarah, Oliver (5), Ruby (1). — User choice; ages changed from 7 and 2 the same day.
- 2026-11-09 — Personalities are fully random at the start (rolled from the seed). — User choice.
- 2026-11-09 — Money uses realistic starting levels for a family who bought the house within the last couple of years (see FAMILY.md). — User choice. Sources for the figures are listed in FAMILY.md.

## OPEN
- Exact bill and council tax figures for Birmingham. Set them in `data/` once checked against current official figures.
- Always-on option. Not possible on GitHub Pages alone (it only serves files). If wanted later: a free cloud service or the Chromebox. Catch-up mode covers the main need for now.
