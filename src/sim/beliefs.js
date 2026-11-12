// Beliefs and observations (docs/LIFE_SYSTEMS.md 4c, and the L5 brief in 4e). Pure logic: no DOM,
// no random numbers. A belief is what one person THINKS a value is (person.beliefs[subjectId]).
// It changes only through observations: checking the bank app makes it exact, and noticing a money
// event moves it by what was applied. Old beliefs drift with the person's anxiety. Opt-in: a world
// built without data/beliefs.json has no beliefs (setupBeliefs is not called, so nothing here runs).
//
// truthOf() is the real value. Only observations, the panel's build-time line, the why trace's
// "really" field and the replay harness may call it. The brain and the couplings must read beliefs.
import { pounds } from './household.js';

const clone = (x) => JSON.parse(JSON.stringify(x));
const cents = (x) => Math.round(x * 100) / 100;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

const subjectDef = (world, subjectId) => world.beliefs?.subjects.find((s) => s.id === subjectId) ?? null;

// Does this subject concern this person? (who: each, or adults = age 18 and over.)
const holdsBelief = (subject, person) => subject.who === 'each' || (subject.who === 'adults' && person.age >= 18);

// The real value of a subject: the plus stocks less the minus stocks, to the penny. null when the
// subject or one of its stocks does not exist (a world without money).
export function truthOf(world, subjectId) {
  const subject = subjectDef(world, subjectId);
  if (!subject) return null;
  let total = 0;
  for (const id of subject.truth.plus) {
    if (!world.stocks[id]) return null;
    total += world.stocks[id].value;
  }
  for (const id of subject.truth.minus) {
    if (!world.stocks[id]) return null;
    total -= world.stocks[id].value;
  }
  return cents(total);
}

// Give every person who holds a subject a belief equal to the truth, as known at this time. Called
// by createWorld when the data is given, and again by a load of an older save (after its stocks
// are restored). Every person gets person.beliefs, even if it is empty.
export function setupBeliefs(world, data) {
  world.beliefs = { subjects: clone(data.subjects) };
  for (const person of world.people) {
    person.beliefs = {};
    for (const subject of world.beliefs.subjects) {
      if (!holdsBelief(subject, person)) continue;
      const truth = truthOf(world, subject.id);
      if (truth === null) continue;
      person.beliefs[subject.id] = { value: truth, seenAt: world.time, source: 'known at the start', drifted: 0 };
    }
  }
}

// Hours since the person last looked at (or was told) this belief.
export function beliefAgeHours(belief, time) {
  return (time - belief.seenAt) / 60;
}

// The observation by checking (the bank app): the belief becomes the truth, exactly, and its age
// goes back to 0. Returns the log line, or null when the person has no such belief.
export function checkSubject(world, person, subjectId) {
  const subject = subjectDef(world, subjectId);
  const belief = person.beliefs?.[subjectId];
  if (!subject || !belief) return null;
  const truth = truthOf(world, subjectId);
  if (truth === null) return null;
  belief.value = truth;
  belief.seenAt = world.time;
  belief.source = subject.check.source;
  belief.drifted = 0;
  return subject.check.logText.replace('{value}', pounds(truth));
}

// A money event the person notices (a flow listed in the subject's noticed list) moved the truth by
// `applied`. Each holder's belief moves by the same amount. Its age does not reset: they did not
// see the balance. Money nobody notices changes the truth only.
export function noticeFlow(world, flowId, stockId, applied) {
  if (!world.beliefs || applied === 0) return;
  for (const subject of world.beliefs.subjects) {
    if (!subject.noticed.includes(flowId)) continue;
    let delta;
    if (subject.truth.plus.includes(stockId)) delta = applied;
    else if (subject.truth.minus.includes(stockId)) delta = -applied;
    else continue;
    for (const person of world.people) {
      const belief = person.beliefs?.[subject.id];
      if (belief) belief.value = cents(belief.value + delta);
    }
  }
}

// Once per game hour: an old belief slides in the direction of the person's temper. Anxious people
// (above 5) drift down, calm ones (below 5) up. The total drift since the last check is capped at
// maxDrift pounds either way. Drift is not rounded, so 24 hours at a steady rate add up exactly.
export function driftBeliefs(world) {
  if (!world.beliefs) return;
  for (const person of world.people) {
    const anxious = person.personality?.anxious ?? 5;
    for (const subject of world.beliefs.subjects) {
      const belief = person.beliefs?.[subject.id];
      if (!belief || beliefAgeHours(belief, world.time) < subject.drift.afterHours) continue;
      const step = (subject.drift.perDayPerPoint * (5 - anxious)) / 24;
      if (step === 0) continue;
      const max = subject.drift.maxDrift;
      const next = clamp(belief.drifted + step, -max, max);
      belief.value += next - belief.drifted;
      belief.drifted = next;
    }
  }
}

// The worry score for an action that checks a subject. It reads only the belief (its age, and
// whether it says the money is low) and the person's stress, never the truth. 0 when the person
// holds no such belief, so the action is never chosen in such a world.
export function worryScore(person, action, time, world, stress) {
  const subject = subjectDef(world, action.observes);
  const belief = person.beliefs?.[action.observes];
  if (!subject || !belief) return 0;
  const c = subject.check;
  const term = (beliefAgeHours(belief, time) / 24) * c.perDayOld
    + (belief.value < c.worryBelow ? c.lowBonus : 0);
  return term * (1 + stress / c.stressPer);
}
