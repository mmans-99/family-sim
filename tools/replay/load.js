// Loads the game's data files for the replay harness (docs/LIFE_SYSTEMS.md 15a, Step 2).
// This is the only file in tools/replay/ that reads from disk; the rest is pure.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (root, file) => JSON.parse(readFileSync(join(root, 'data', file), 'utf8'));

// rootDir is the repository folder (the one that holds data/).
export function loadData(rootDir) {
  return {
    house: read(rootDir, 'house.json'),
    actions: read(rootDir, 'actions.json'),
    needs: read(rootDir, 'needs.json'),
    people: read(rootDir, 'people.json'),
    calendar: read(rootDir, 'calendar.json'),
    money: {
      stocks: read(rootDir, 'stocks.json'),
      tax: read(rootDir, 'tax.json'),
      flows: read(rootDir, 'flows.json'),
    },
    replay: read(rootDir, 'replay.json'),
  };
}
