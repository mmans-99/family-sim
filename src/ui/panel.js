// The watch-only status panel: what each person is doing, where, their needs as bars, and
// the latest lines from the activity log. It only reads the world; it never changes it.

const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function clockText(time) {
  const h = String(Math.floor((time % 1440) / 60)).padStart(2, '0');
  const m = String(time % 60).padStart(2, '0');
  return `${h}:${m}`;
}

// What someone is doing, in a few words.
export function doingText(person) {
  const a = person.activity;
  if (!a) return 'Thinking what to do';
  return a.phase === 'walk' ? `On the way to: ${a.action.label.toLowerCase()}` : a.action.label;
}

// Green when a need is met, amber when it is getting low, red when it is urgent.
function barColour(v) {
  return v >= 50 ? '#5a9e4b' : v >= 25 ? '#d99a2b' : '#c8483c';
}

// One short line under the clock, so the main thing is visible without scrolling.
export function renderStatusLine(el, world, roomName) {
  el.textContent = world.people.map((p) => `${p.name}: ${doingText(p)} (${roomName(world, p)})`).join(' · ');
}

export function renderPanel(el, world, roomName) {
  el.innerHTML = world.people.map((p) => {
    const bars = Object.entries(world.needDefs).map(([id, def]) => {
      const v = Math.round(p.needs[id]);
      return `<div class="need"><span>${esc(def.label)}</span>`
        + `<span class="track"><span class="fill" style="width:${v}%;background:${barColour(v)}"></span></span>`
        + `<span class="num">${v}</span></div>`;
    }).join('');
    const lines = world.log.filter((e) => e.who === p.name).slice(-5).reverse()
      .map((e) => `<li><span class="t">${clockText(e.time)}</span> ${esc(e.text)}</li>`).join('');
    return `<div class="person"><div class="who"><b>${esc(p.name)}</b> (${esc(p.role)}, ${p.age})`
      + ` · ${esc(doingText(p))} · ${esc(roomName(world, p))}</div>`
      + `<div class="needs">${bars}</div><ol class="log">${lines}</ol></div>`;
  }).join('');
}
