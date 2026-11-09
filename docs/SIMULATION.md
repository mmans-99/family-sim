# Simulation design — how the people "think"

## 1. Needs (0–100, drop over time)
Hunger, Energy, Bladder, Hygiene, Fun, Social, Comfort.
Rates differ by age (toddlers tire fast, need help with most needs).

## 2. The brain (utility AI)
Every time a person finishes an action, they score every possible action:

    score = how much it fixes my needs (urgent needs count much more)
          × personality fit (lazy person likes sofa more)
          × mood modifier
          + obligations (work at 9, school run)
          − effort / travel time

Then pick from the top few with weighted randomness, so they're not robots.
Each person also has a few **goals** (get promoted, learn to ride a bike,
save for a car) that add score to related actions.

## 3. Personality
5 sliders (0–10): Outgoing, Tidy, Active, Kind, Anxious + a few traits
(e.g. bookworm, foodie, short-tempered). Children inherit a blend of parents
plus randomness.

## 4. Emotions and mood
- Mood = mostly from how satisfied needs are + recent events.
- Emotions are short-lived (happy, sad, angry, stressed, bored, excited,
  scared) caused by events and fading over hours/days.
- Memories: important events are stored and can be recalled
  ("still upset about losing the job").

## 5. Relationships
Each pair has Fondness and Tension. Changed by talks, arguments, help, time
spent together. Drives who chats, who argues, who gets married.

## 6. Life stages (on the life clock)
Baby · Toddler · Child · Teen · Young adult · Adult · Elder.
Each stage unlocks/locks actions (toddler can't use cooker, teen can get a
part-time job). Birthdays move people up stages.

## 7. Outside the house
Off-screen locations: work, school, nursery, shops, park, friend's house,
gym, doctor. While away, a person runs a simplified version of the sim and
produces commentary lines from templates in `data/text/`
(e.g. "{name} had a long meeting and feels {emotion}").

## 8. Economy
Household money; wages per job; bills weekly; food shopping. A world economy
value (boom ↔ recession) shifts prices, pay rises, job-loss chance.

## 9. Weather & seasons
Spring/Summer/Autumn/Winter. Daily weather (sun, rain, snow, heatwave).
Affects mood, outdoor plans, heating bills, illness chance.

## 10. Time (see DECISIONS #2)
Day clock and life clock run separately so days feel real but lives still
move at a watchable pace.

## 11. Growing the family
Adults can form partnerships with off-screen people (generated characters),
marry, have babies; grown children can move out (they leave the house view
but stay in the family tree and commentary).
