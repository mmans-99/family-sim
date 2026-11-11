# Roadmap

Each phase ends with something you can open and watch.

## Phase 0 — Planning
- [x] Vision, architecture, simulation design docs
- [x] Settle open decisions (see DECISIONS.md)
- [x] Create GitHub repo (`mmans-99/family-sim`, public)
- [x] GitHub Pages hosting turned on (live at mmans-99.github.io/family-sim)

## Phase 1 — The house and one person
- [x] Clock with speed controls (pause / 1x / 2x / 4x)
- [x] House map: top-down pixel-art plan of the ground floor, first floor and garden, with walls, doorways, windows, stairs and furniture drawn from the Sierrassets sprite pack, plus our own extras (stairs, shed, tree, lawn, path, rugs, front wall face). UK 3-bed semi layout, every room checked as walkable. Whole-house view on one screen, plus one view per floor. Pan and zoom.
- [x] Objects: bed, fridge, cooker, toilet, bath (shower over it), sofa, TV, armchair, basin, sink, washing machine, garden chairs (`data/actions.json`)
- [x] One adult who walks (pathfinding, stairs, back door) and uses objects: Sarah
- [x] Needs that drop over time; picks actions to fix them
- [x] Watch-only status line and panel: what she is doing, where, need bars, recent log
- [ ] Save/load

## Phase 2 — The family
- [ ] All four family members, with age-based abilities (toddler can't cook)
- [ ] Carers: adults must feed/change/supervise the toddler
- [ ] Personality traits affect choices
- [ ] Mood + emotions shown as bubbles
- [ ] Relationships between each pair (fondness, tension)
- [ ] Conversations / shared activities

## Phase 3 — Leaving the house
- [ ] Work, school, nursery schedules
- [ ] Off-screen activities (shopping, park, friends, gym)
- [ ] Running text commentary feed for people outside
- [ ] Money: wages, bills, food shopping, savings

## Phase 4 — The world
- [ ] Weather + seasons (affects mood, plans, bills)
- [ ] Economy: prices, pay rises, job loss, recession/boom, energy price cap changes
- [ ] Random life events (illness, promotion, broken boiler, birthday)
- [ ] "While you were away" catch-up summary

## Phase 5 — Lives over time
- [ ] Ageing and life stages (toddler → child → teen → adult → elder)
- [ ] Skills and school grades; career choices
- [ ] Friends, dating, marriage, moving out, new babies
- [ ] Old age, death, grief
- [ ] Family tree and per-person diary

## Phase 6 — Polish
- [ ] Better art and animation
- [ ] Sound
- [ ] Optional nudges / god mode
- [ ] Optional: sim runs 24/7 on a home server
