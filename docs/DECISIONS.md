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
- 2026-11-09 — Art style: pixel art. The house is a UK 3-bed semi-detached with two floors plus a back garden. — User choice.
- 2026-11-09 — Player control of the family: watch only. The player can view status, health, mood, money and history, but cannot change anything. — User choice.
- 2026-11-09 — Camera control is for viewing only. The player can turn, tilt, pan and zoom the house, but cannot change what the family does. — Keeps the watch-only rule while letting the player look around.
- 2026-11-09 — House view: a 3D dollhouse (walls, doorways, windows, stairs, furniture) rendered in a pixel-art style, with a cutaway on by default that lowers the walls nearest the camera. — User asked for the house to look like a real house with innards, plus pixel art and a cutaway.
- 2026-11-09 — The family lives in an urban UK city. Dad is a WFH software engineer on £70-80k. Mum is a stay-at-home mum. They have a mortgage and average UK bills. — User choice.
- 2026-11-09 — The world must feel life-like and keep evolving over time (ongoing events, ageing, economy, seasons), not reset or repeat. — User choice.
- 2026-11-09 — City: Birmingham (West Midlands). — User choice; the city is a single setting, so it's easy to change later.
- 2026-11-09 — Family names: Dad Tom, Mum Sarah, Oliver (5), Ruby (1). — User choice. Ages changed from 7 and 2 the same day.
- 2026-11-09 — Personalities are fully random at the start (rolled from the seed). — User choice.
- 2026-11-09 — Money uses realistic starting levels for a family who bought the house within the last couple of years (see FAMILY.md). — User choice. Sources for the figures are listed in FAMILY.md.

- 2026-11-09 — House view looks crisp, not blurry: every pixel is snapped to a fixed 10-level-per-channel palette, and each art pixel is a whole number of screen pixels. Backdrop is navy and outlines dark violet, to match the reference style the user shared. — The blurry look came from anti-aliased edges mixing in-between colours. Procedural 3D can't match hand-drawn art exactly; see OPEN for sprites.
- 2026-11-09 — Look changed to a Kairosoft-style cosy house: warm cream backdrop, dark brown outlines, wood-tile floors drawn one tile at a time, and warm window light and lamps. Furniture and rooms snap to whole grid tiles (doors one tile wide, windows one tile wide, stairs one tile per step). Key pieces are chunkier (chibi proportions). — User asked for this after rejecting the blue, blurry look. Whole tiles stop items looking awkwardly placed.
- 2026-11-09 — Hand-drawn pixel art is the goal. Art is drawn by hand as pixel sprites (I draw it, not a bought pack). Camera: free rotation. Each sprite needs drawing in four angles. — User chose this after rejecting the blurry 3D look. Trade-off: about four times the art of a fixed view; edges step while turning.
- 2026-11-09 — Drawing is pixel-exact (`raster.js`): no anti-aliasing, so every edge is on whole pixels. — The blur came from anti-aliased canvas fills.
- 2026-11-09 — Camera changed for a trial: fixed isometric tilt (about 35 degrees). The house turns in 90-degree steps with the turn buttons. One-finger drag pans. Pinch and wheel zoom. Look-down and level buttons removed. — Hand-drawn sprites from packs are drawn in fixed isometric angles, so free rotation is not practical. User asked to see the house at 90 degrees. Supersedes the free-rotation choice above if the trial is kept.
- 2026-11-09 — Art source for the hand-drawn look: the free Pixel Isometric Modern Interior pack by Cryovex (free version). Licence: commercial use and editing allowed, credit appreciated, no redistribution. User chose it. Not yet downloaded, because the build sandbox cannot reach itch.io.
- 2026-11-09 — Camera tilt changed to 30 degrees (2:1 tiles), to match the sprite pack. — The pack's floor tiles are 16 by 8 pixels.
- 2026-11-09 — Pack images are kept in `assets/cryovex/`, which git ignores, so they never reach the public repo. The game falls back to blocks without them. — Cryovex licence forbids redistribution. Revisit when the repo is private.

- 2026-11-10 — Art source changed from the Cryovex pack to the Sierrassets "Furniture pack" (flat front/side-view furniture sheet, floor and walls sheet, about 500 furniture slices). The user chose it and said its source page allows use. — The Cryovex pack is isometric, so it does not fit a flat view. The zip itself has no licence text, so redistribution rests on the user's statement; see the next entry.
- 2026-11-10 — Camera changed to a flat front/side view: no tilt, no 90-degree turns, zoom and pan only. The house is seen straight on, cut away as before. — The user chose the flat view because the new pack is drawn flat. Supersedes the 30-degree tilt and the turn buttons.

## OPEN
- 2026-11-10 — The user confirmed the Sierrassets pack images may be committed and distributed, and asked for them to go in the repo. Their git-ignore rule was removed; the two sheets are committed in `assets/furniture-pack/`. — User choice. The zip has no licence text, so this rests on the user's statement; the exact source wording is not yet recorded.
- Sierrassets pack licence wording: still to record. The user's statement is the only record so far. Ask the user for the exact text from the source page, and file it here. — Keeps the record checkable.
- Cryovex pack licence (superseded: Cryovex is no longer used): the page says the asset may not be redistributed, even if modified. The house is on a public GitHub Pages site, so the pack's image files cannot go in the repo as they are. Options: get written permission from Cryovex, use our own art, or find a pack that allows redistribution (CC0 or CC BY). Decide before any pack art is committed.
- Bill figures not yet covered: broadband, phone, car or transport, food and general spending. Need checked sources before they go in `data/`.
- Whether to add a car (affects bills and commuting).
- Always-on option. Not possible on GitHub Pages alone (it only serves files). If wanted later: a free cloud service or the Chromebox. Catch-up mode covers the main need for now.
- Hand-drawn pixel sprites, four angles each, replacing the block shapes one item at a time. Plan: sofa, bed and table first. Approved 2026-11-09.
