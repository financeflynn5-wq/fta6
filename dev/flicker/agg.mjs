// collect all pairs from logs (works on partial logs)
import fs from 'fs';
const files = process.argv.slice(2);
const pairs = new Map(); let views = 0, bad = 0;
for (const f of files) {
  let view = null;
  for (const line of fs.readFileSync(f, 'utf8').split('\n')) {
    let m = line.match(/^(\S+)\s+fighting px: (\d+)/);
    if (m) { view = m[1]; views++; if (+m[2] > 30) bad++; continue; }
    m = line.match(/^\s+(\d+)\s+(.*?) \[(.*?)\]\s+x\s+(.*?) \[(.*?)\]\s+at (\S*)\s+gap (\S+)mm/);
    if (!m) continue;
    const key = [m[2], m[4]].sort().join('  x  ');
    let p = pairs.get(key); if (!p) pairs.set(key, p = { n: 0, views: 0, ex: [] });
    p.n += +m[1]; p.views++; if (p.ex.length < 4 || +m[1] > p.ex[0].n) { p.ex.push({ n: +m[1], view, at: m[6], gap: m[7] }); p.ex.sort((a, b) => b.n - a.n); p.ex.length = Math.min(4, p.ex.length); }
  }
}
console.log('views', views, 'with >30 px:', bad);
for (const [k, p] of [...pairs.entries()].sort((a, b) => b[1].n - a[1].n).slice(0, +process.env.TOP || 60))
  console.log(String(p.n).padStart(7), String(p.views).padStart(4), k, '\n          ' + p.ex.map(e => `${e.view}(${e.n}) at ${e.at} gap ${e.gap}`).join(' | '));
