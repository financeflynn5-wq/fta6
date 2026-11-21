// usage: node who.mjs "x,y,z,dx,dy,dz" ...   lists what a ray from each point hits (first 6 things), with each mesh's size and place
import { createRequire } from 'module'; const { chromium } = createRequire(import.meta.url)('playwright');
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
page.on('pageerror', e => console.log('PAGEERROR', e.message));
await page.goto('http://localhost:8765/index.html?test', { waitUntil: 'load' });
await page.waitForFunction(() => window.__fta && window.__fta.advance, null, { timeout: 240000 });
await page.evaluate(async () => { window.THREE = await import('three'); const g = window.__fta; g.noRender = true; g.setState('playing'); for (let i = 0; i < 3; i++) g.advance(1 / 60); });
for (const a of process.argv.slice(2)) {
  const v = a.split(',').map(Number);
  const r = await page.evaluate((v) => {
    const g = window.__fta, T = window.THREE, ray = new T.Raycaster(new T.Vector3(v[0], v[1], v[2]), new T.Vector3(v[3], v[4], v[5]).normalize(), 0, v[6] || 30);
    ray.camera = g.engine.camera; const list = []; g.scene.traverse(o => { if (o.isMesh) list.push(o); }); const hits = ray.intersectObjects(list, false), out = [], seen = new Set();
    for (const h of hits) {
      const o = h.object; if (seen.has(o.uuid + (h.instanceId ?? ''))) continue; seen.add(o.uuid + (h.instanceId ?? ''));
      const m = [].concat(o.material)[0]; if (!m || !m.color) continue;
      const b = new T.Box3();
      if (o.isInstancedMesh && h.instanceId !== undefined) { const mm = new T.Matrix4(); o.getMatrixAt(h.instanceId, mm); o.geometry.computeBoundingBox(); b.copy(o.geometry.boundingBox).applyMatrix4(mm).applyMatrix4(o.matrixWorld); }
      else b.setFromObject(o);
      const f = (x) => +x.toFixed(2);
      out.push(`d=${f(h.distance)} #${m.color.getHexString()}${m.map ? '+map' : ''}${m.polygonOffset ? '+po' : ''} ${o.isInstancedMesh ? 'inst' + h.instanceId : ''} tris=${Math.round((o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3)} box=[${f(b.min.x)},${f(b.min.y)},${f(b.min.z)}]..[${f(b.max.x)},${f(b.max.y)},${f(b.max.z)}] n=${h.face ? [f(h.face.normal.x), f(h.face.normal.y), f(h.face.normal.z)] : ''} at=${[f(h.point.x), f(h.point.y), f(h.point.z)]}`);
      if (out.length >= 7) break;
    }
    return out;
  }, v);
  console.log(a + '\n  ' + r.join('\n  '));
}
await browser.close();
