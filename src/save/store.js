// Keeps the save in the browser (localStorage), so it survives closing the page. Only this
// file touches browser storage; the logic is in src/sim/save.js.
const KEY = 'family-sim.save';

export function readSave() {
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    console.warn('The saved game could not be read; starting a new one.', err);
    return null;
  }
}

export function writeSave(data) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch (err) {
    console.warn('The game could not be saved.', err); // e.g. storage full or blocked
    return false;
  }
}

export function clearSave() {
  try { window.localStorage.removeItem(KEY); } catch (err) { console.warn(err); }
}
