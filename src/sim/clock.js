// Game clock. Pure logic: no drawing and no browser APIs, so it runs anywhere.
// Timing (from docs/DECISIONS.md):
//   1 game minute = 6.25 real seconds at 1x   (1 game hour = 6.25 real minutes)
//   1 game day    = 2.5 real hours
//   1 game year   = 28 game days = 70 real hours

export const REAL_MS_PER_GAME_MINUTE = 6250;
export const MINUTES_PER_DAY = 24 * 60;
export const DAYS_PER_YEAR = 28;
export const MINUTES_PER_YEAR = MINUTES_PER_DAY * DAYS_PER_YEAR;
export const SEASONS = ['Spring', 'Summer', 'Autumn', 'Winter']; // 7 game days each
export const SPEEDS = [0, 1, 2, 4]; // 0 = paused

// startMinute counts game minutes from the start of Year 1, Day 1.
export function createClock(startMinute = 7 * 60) {
  return { totalMinutes: startMinute, speed: 1, carryMs: 0 };
}

export function setSpeed(clock, speed) {
  if (!SPEEDS.includes(speed)) throw new Error(`Unknown speed: ${speed}`);
  clock.speed = speed;
}

// Move the clock forward by realMs of wall-clock time.
// Returns how many whole game minutes passed.
export function advance(clock, realMs) {
  if (clock.speed === 0 || realMs <= 0) return 0;
  clock.carryMs += realMs * clock.speed;
  const minutes = Math.floor(clock.carryMs / REAL_MS_PER_GAME_MINUTE);
  clock.carryMs -= minutes * REAL_MS_PER_GAME_MINUTE;
  clock.totalMinutes += minutes;
  return minutes;
}

// Human-readable reading of the clock.
export function readClock(clock) {
  const t = clock.totalMinutes;
  const year = Math.floor(t / MINUTES_PER_YEAR) + 1;
  const dayOfYear = Math.floor((t % MINUTES_PER_YEAR) / MINUTES_PER_DAY);
  const minuteOfDay = t % MINUTES_PER_DAY;
  return {
    year,
    day: dayOfYear + 1,
    season: SEASONS[Math.floor(dayOfYear / 7)],
    hour: Math.floor(minuteOfDay / 60),
    minute: minuteOfDay % 60,
    speed: clock.speed,
  };
}
