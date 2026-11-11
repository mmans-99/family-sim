// Turning points (docs/LIFE_SYSTEMS.md section 15 and 15a, Step 5). Pure.
// A turning point is a game day on which a money stock moved much more than usual. Its causes
// are the ledger reasons that day, largest first.

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  const n = s.length;
  if (n === 0) return 0;
  return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
};

// days: [{ gameDay, date, stock, net, gross, byReason: { reason: amount } }] from the money probe.
// cfg: data/replay.json "turningPoints".
export function findTurningPoints(days, cfg) {
  const byStock = {};
  for (const d of days) (byStock[d.stock] ??= []).push(d);
  const points = [];
  for (const [stock, list] of Object.entries(byStock)) {
    const typical = median(list.map((d) => Math.abs(d.net)));
    for (const d of list) {
      const size = Math.abs(d.net);
      if (size < cfg.minChange || size < cfg.timesMedian * typical) continue;
      const causes = Object.entries(d.byReason)
        .filter(([, amount]) => amount !== 0)
        .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]) || a[0].localeCompare(b[0]))
        .slice(0, cfg.maxCauses)
        .map(([reason, amount]) => ({
          reason,
          amount,
          big: Math.abs(amount) >= cfg.bigCauseShare * d.gross,
        }));
      points.push({
        gameDay: d.gameDay,
        date: d.date,
        stock,
        change: d.net,
        causes,
        bigCauses: causes.filter((c) => c.big).length,
      });
    }
  }
  return points.sort((a, b) => a.gameDay - b.gameDay || a.stock.localeCompare(b.stock));
}
