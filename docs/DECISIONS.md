# Decisions

Newest at the bottom. Format: date — decision — why.

## SETTLED
- 2026-11-09 — The house is the whole visual world; outside is text only. — Keeps scope buildable.
- 2026-11-09 — Simulation code is separate from drawing code. — Needed for catch-up and for a future always-on version.
- 2026-11-09 — No paid AI required; commentary built from text templates. — User preference, no subscriptions.
- 2026-11-09 — Platform: web app (HTML + JavaScript), hosted on GitHub Pages from the public repo `mmans-99/family-sim`. — User choice. Pages works because the repo is public.
- 2026-11-09 — Time: 1 game hour = 2.5 real minutes. A game day = 1 real hour. A game year = 28 game days = 28 real hours. Speeds: pause, 1x, 2x, 4x, and skip. — User wants slower pace so nothing is missed.
- 2026-11-09 — When the app is closed, the sim is not paused. On reopen, it catches up all missed time from the saved state and shows a "while you were away" summary. — User wants the family to keep living without a server.
- 2026-11-09 — Art style: isometric pixel art. House is a UK 3-bed semi-detached with two floors plus a back garden (replaces the earlier one-floor idea). — User choice.
- 2026-11-09 — Player control: watch only. No controls over the family. The player can view status, health, mood, money and history, but cannot change anything. — User choice.
- 2026-11-09 — The family lives in an urban UK city. Dad is a WFH software engineer on £70-80k. Mum is a stay-at-home mum. They have a mortgage and average UK bills. — User choice.
- 2026-11-09 — The world must feel life-like and keep evolving over time (ongoing events, ageing, economy, seasons), not reset or repeat. — User choice.

## OPEN
- Exact city (affects weather and council tax). Not yet chosen.
- Family names. Proposals: Dad Tom, Mum Sarah, child Oliver (7), toddler Ruby (2). Waiting for user to confirm or change.
- Always-on option. Not possible on GitHub Pages alone (it only serves files). If wanted later: a free cloud service (e.g. Cloudflare Workers or a free VM tier) or the Chromebox. Catch-up mode covers the main need for now.
