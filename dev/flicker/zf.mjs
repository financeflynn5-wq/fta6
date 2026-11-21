// usage: node zf.mjs <views.json | "x,y,z,tx,ty,tz"> [--shot name] [--near .3] [--port 8765] [--out file.json]
// views.json: [{ name, pos:[x,h,z], look:[x,y,z], rel:true }]  (rel: heights are above the ground at that spot)
import { createRequire } from 'module'; const { chromium } = createRequire(import.meta.url)('playwright');
import fs from 'fs';
const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf('--' + k); return i < 0 ? d : args[i + 1]; };
const port = opt('port', 8765), nearArg = opt('near', '.3'), near = nearArg === 'game' ? 'game' : +nearArg, shotName = opt('shot', ''), outFile = opt('out', ''), nudge = +opt('nudge', 1.03);
let views;
if (args[0].endsWith('.json')) views = JSON.parse(fs.readFileSync(args[0], 'utf8'));
else { const v = args[0].split(',').map(Number); views = [{ name: 'v', pos: v.slice(0, 3), look: v.slice(3, 6), rel: args.includes('--rel') }]; }
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', e => errors.push('PAGEERROR: ' + (e.stack || e.message).slice(0, 900)));
page.on('console', m => { if (m.text().startsWith('T:')) console.log(m.text()); });
const t0 = Date.now();
await page.goto(`http://localhost:${port}/index.html?test`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__fta && window.__fta.advance, null, { timeout: 240000 });
await page.evaluate(async () => { window.THREE = await import('three'); window.__terrain = await import('./src/world/terrain.js'); const g = window.__fta; g.noRender = true; g.setState('playing'); for (let i = 0; i < 5; i++) g.advance(1 / 60); });
await page.addScriptTag({ path: new URL('./zf-page.js', import.meta.url).pathname });
console.log('booted', ((Date.now() - t0) / 1000).toFixed(1), 's');
const results = [];
for (const v of views) {
  const r = await page.evaluate(([v, near, nudge]) => {
    let pos = v.pos.slice(), look = v.look.slice();
    if (v.rel) { const gy = window.__terrain.groundY(pos[0], pos[2]); pos[1] += gy; look[1] += window.__terrain.groundY(look[0], look[2]); }
    {
      // ask the game what it would pick here: a camera following something a dozen metres ahead (a helicopter, or Rocco on foot)
      const g = window.__fta, c = g.engine.camera, p = g.player, d = [look[0] - pos[0], look[1] - pos[1], look[2] - pos[2]], l = Math.hypot(...d) || 1, far = pos[1] - window.__terrain.groundY(pos[0], pos[2]) > 12 ? 12 : 6.6;
      c.position.set(...pos); p.x = pos[0] + d[0] / l * far; p.y = pos[1] + d[1] / l * far - 1; p.z = pos[2] + d[2] / l * far;
      const keepU = g.cam.update; g.cam.update = () => {}; c.near = .3; g.world.update(1 / 60, 0); g.cam.update = keepU; if (near === 'game') near = c.near;      // (this also thins the haze the way the game does up high, for the screenshots)
    }
    const r = window.zf.scan(pos, look, { near, nudge, top: 10 }); r.pos = pos; r.look = look; r.near = near; return r;
  }, [v, near, nudge]);
  r.name = v.name; results.push(r);
  console.log(`${v.name}  fighting px: ${r.total}  near ${(+r.near).toFixed(2)}`);
  for (const p of r.pairs.slice(0, 6)) if (p.n >= 6) console.log(`   ${String(p.n).padStart(6)}  ${p.a.mat || p.a} [${p.a.path || ''} ${p.a.tris || ''}]  x  ${p.b.mat || p.b} [${p.b.path || ''} ${p.b.tris || ''}]  at ${p.at}  gap ${p.gapMM}mm`);
  if (shotName) {
    await page.evaluate(([pos, look]) => { const g = window.__fta, c = g.engine.camera; c.position.set(...pos); c.lookAt(...look); c.aspect = 960 / 540; c.updateProjectionMatrix(); g.engine.render(); window.zf.overlay(false); document.getElementById('hud').style.display='none'; }, [r.pos, r.look]);
    await page.screenshot({ path: `${shotName}-${v.name}.png`, timeout: 180000 });
    await page.evaluate(() => window.zf.overlay(true)); await page.screenshot({ path: `${shotName}-${v.name}-mask.png`, timeout: 180000 }); await page.evaluate(() => window.zf.overlay(false));
  }
}
if (outFile) fs.writeFileSync(outFile, JSON.stringify(results));
if (errors.length) console.log('ERRORS:\n' + [...new Set(errors)].slice(0, 8).join('\n'));
await browser.close();
