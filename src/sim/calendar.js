// The calendar: real dates on the life clock (docs/LIFE_SYSTEMS.md section 2). Pure logic.
// One game day stands for 365 / 28 calendar days, so bills, pay and holidays fall on their
// real dates while a game day is still a full day of meals and bedtime.
// All maths is whole numbers (no current time, no time zones), so the same time always gives
// the same date.
import { MINUTES_PER_DAY, DAYS_PER_YEAR } from './clock.js';

export const CAL_DAYS_PER_YEAR = 365;
const MS_PER_DAY = 86400000;
export const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Calendar days from the start date, at a game minute.

// The calendar date for a number of calendar days after the start date.
export function dateAt(index, start) {
  const d = new Date(Date.UTC(start.year, start.month - 1, start.day) + index * MS_PER_DAY);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

// The first calendar date of the game day a minute is in.
export function calendarDate(time, start) {
  return dateAt(calendarSpan(Math.floor(time / MINUTES_PER_DAY))[0], start);
}

// The first and last calendar day index covered by a whole game day (0 = the first game day).
// Each calendar day belongs to exactly one game day: a game day starts where the last one ended.
const startIndex = (gameDay) => Math.floor((gameDay * CAL_DAYS_PER_YEAR) / DAYS_PER_YEAR);
export function calendarSpan(gameDay) {
  return [startIndex(gameDay), startIndex(gameDay + 1) - 1];
}

// Does a dated rule fall on this calendar date? Rules: monthly (on `day`, optionally only in
// `months`), quarterly (on `day` in `months`), yearly (on `month` and `day`).
function matches(rule, d) {
  switch (rule.repeat) {
    case 'monthly':
      return (!rule.months || rule.months.includes(d.month)) && d.day === rule.day;
    case 'quarterly':
      return rule.months.includes(d.month) && d.day === rule.day;
    case 'yearly':
      return d.month === rule.month && d.day === rule.day;
    default:
      throw new Error(`Unknown repeat "${rule.repeat}" in rule ${rule.id}`);
  }
}

// Every dated rule that falls in this game day, with the hour it fires at.
export function dueOnGameDay(gameDay, rules, start) {
  const [first, last] = calendarSpan(gameDay);
  const due = [];
  for (let i = first; i <= last; i++) {
    const date = dateAt(i, start);
    for (const rule of rules) {
      if (matches(rule, date)) due.push({ id: rule.id, label: rule.label, hour: rule.hour, date });
    }
  }
  return due;
}

// 0 = Monday. Follows the game days (the week is 7 game days), not the calendar.
export function weekday(time) {
  return Math.floor(time / MINUTES_PER_DAY) % 7;
}

export function formatDate(d) {
  return `${d.day} ${MONTH_NAMES[d.month - 1]} ${d.year}`;
}

// The dates a game day covers, for the clock: "27 Mar 2026 – 8 Apr 2026". Every dated event
// that fires during the game day has its date inside this range.
export function gameDayDates(time, start) {
  const [first, last] = calendarSpan(Math.floor(time / MINUTES_PER_DAY));
  return `${formatDate(dateAt(first, start))} – ${formatDate(dateAt(last, start))}`;
}
