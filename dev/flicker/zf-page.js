// Injected into the game page. Finds z-fighting by drawing every mesh in a flat colour of its own, twice,
// with the near plane nudged in between: the picture is identical except where two surfaces are too close
// for the depth buffer to tell apart. window.zf.scan(pos, look, opts) -> list of fighting pairs.
(() => {
  const g = window.__fta, THREE = g.THREE || window.THREE;
  const R = g.engine.renderer, scene = g.scene, cam = g.engine.camera;
  const W = 960, H = 540;
  const rt = new THREE.WebGLRenderTarget(W, H, { depthBuffer: true, samples: 0 });
  const bufA = new Uint8Array(W * H * 4), bufB = new Uint8Array(W * H * 4);
  const ray = new THREE.Raycaster();
  const idMat = new Map();
  function describe(o) {
    const m = Array.isArray(o.material) ? o.material[0] : o.material;
    let p = o, path = [];
    while (p && p !== scene && path.length < 4) { path.push(p.name || p.type); p = p.parent; }
    const bs = o.geometry.boundingSphere || (o.geometry.computeBoundingSphere(), o.geometry.boundingSphere);
    return {
      mat: (m.name || '') + '#' + (m.color ? m.color.getHexString() : '?') + (m.map ? '+map' : '') + (m.vertexColors ? '+vc' : '') + (m.transparent ? '+tr' : '') + (m.polygonOffset ? '+po' + m.polygonOffsetFactor : '') + (m.emissive && m.emissive.getHex() ? '+em' + m.emissive.getHexString() : ''),
      uuid: m.uuid.slice(0, 6), path: path.join('<'), tris: Math.round((o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3),
      inst: o.isInstancedMesh ? o.count : 0,
    };
  }
  function swapIn() {
    const list = []; let id = 1;
    scene.traverse(o => {
      if (o.isSprite || o.isPoints || o.isLine) { list.push([o, null, o.visible]); o.visible = false; return; }
      if (!o.isMesh) return;
      const src = Array.isArray(o.material) ? o.material[0] : o.material;
      if (!src || src.isShaderMaterial || src.isRawShaderMaterial || o.isSky || src.depthTest === false) { list.push([o, null, o.visible]); o.visible = false; return; }
      const my = id++;
      const mk = (s) => {
        const b = new THREE.MeshBasicMaterial({ fog: false, toneMapped: false });
        b.color.setRGB((my & 255) / 255, ((my >> 8) & 255) / 255, ((my >> 16) & 255) / 255, THREE.LinearSRGBColorSpace);
        b.side = s.side; b.polygonOffset = s.polygonOffset; b.polygonOffsetFactor = s.polygonOffsetFactor; b.polygonOffsetUnits = s.polygonOffsetUnits;
        b.depthWrite = s.depthWrite; b.transparent = s.transparent; b.visible = s.visible && s.opacity > .02;
        return b;
      };
      const keep = o.material;
      o.material = Array.isArray(keep) ? keep.map(mk) : mk(keep);
      list.push([o, keep, o.visible, my]); idMat.set(my, o);
    });
    return list;
  }
  function swapOut(list) {
    for (const [o, keep, vis] of list) {
      if (keep) { [].concat(o.material).forEach(m => m.dispose()); o.material = keep; }
      o.visible = vis;
    }
  }
  function draw(buf, near) {
    cam.near = near; cam.updateProjectionMatrix();
    R.setRenderTarget(rt); R.setClearColor(0x000000, 1); R.clear(); R.render(scene, cam);
    R.readRenderTargetPixels(rt, 0, 0, W, H, buf); R.setRenderTarget(null);
  }
  const zf = window.zf = {
    W, H,
    scan(pos, look, { near = .3, nudge = 1.03, fov = 0, top = 8, maxDist = 1e9 } = {}) {
      for (const m of g.city.welded) m.visible = true;
      const keep = { near: cam.near, fov: cam.fov, aspect: cam.aspect, shadow: R.shadowMap.autoUpdate, bg: scene.background, fog: scene.fog };
      if (fov) cam.fov = fov; cam.aspect = W / H;
      cam.position.set(...pos); cam.lookAt(...look); cam.updateMatrixWorld(true);
      R.shadowMap.autoUpdate = false; scene.background = null; scene.fog = null;
      idMat.clear();
      const list = swapIn();
      draw(bufA, near); draw(bufB, near * nudge);
      const pairs = new Map(); let total = 0;
      const mask = [];
      for (let i = 0; i < W * H; i++) {
        const a = bufA[i * 4] | bufA[i * 4 + 1] << 8 | bufA[i * 4 + 2] << 16, b = bufB[i * 4] | bufB[i * 4 + 1] << 8 | bufB[i * 4 + 2] << 16;
        if (a === b) continue; total++; mask.push(i);
        const k = a < b ? a + ',' + b : b + ',' + a; let p = pairs.get(k); if (!p) pairs.set(k, p = { n: 0, px: [] }); p.n++; if (p.px.length < 400) p.px.push(i);
      }
      const out = [];
      const sorted = [...pairs.entries()].sort((x, y) => y[1].n - x[1].n).slice(0, top);
      for (const [k, p] of sorted) {
        const [a, b] = k.split(',').map(Number), oa = idMat.get(a), ob = idMat.get(b);
        const i = p.px[p.px.length >> 1], x = i % W, y = Math.floor(i / W);
        ray.setFromCamera(new THREE.Vector2((x + .5) / W * 2 - 1, (y + .5) / H * 2 - 1), cam);
        let at = null, gap = null;
        const pick = (o) => { if (!o) return null; const keepM = o.material, h = ray.intersectObject(o, false)[0]; return h || null; };
        // raycast needs the real side settings: materials are still the id copies, which carry them
        const ha = pick(oa), hb = pick(ob);
        const h = ha || hb; if (h) at = [+h.point.x.toFixed(2), +h.point.y.toFixed(2), +h.point.z.toFixed(2), +h.distance.toFixed(1)];
        if (ha && hb) gap = +(Math.abs(ha.distance - hb.distance) * 1000).toFixed(2);
        out.push({ n: p.n, a: oa ? describeSwapped(oa, list) : 'bg', b: ob ? describeSwapped(ob, list) : 'bg', at, gapMM: gap });
      }
      swapOut(list);
      cam.near = keep.near; cam.fov = keep.fov; cam.aspect = keep.aspect; cam.updateProjectionMatrix();
      R.shadowMap.autoUpdate = keep.shadow; scene.background = keep.bg; scene.fog = keep.fog;
      zf.lastMask = mask;
      return { total, pairs: out.filter(o => !o.at || o.at[3] < maxDist) };
    },
    // draw the last mask over the page in red, for a screenshot
    overlay(on = true) {
      let c = document.getElementById('zfOverlay');
      if (!c) { c = document.createElement('canvas'); c.id = 'zfOverlay'; c.width = W; c.height = H; c.style.cssText = 'position:fixed;left:0;top:0;width:100vw;height:100vh;z-index:99999;pointer-events:none'; document.body.appendChild(c); }
      const x = c.getContext('2d'); x.clearRect(0, 0, W, H); if (!on) return;
      x.fillStyle = 'rgba(255,0,60,.9)'; for (const i of zf.lastMask) x.fillRect(i % W - 1, H - 1 - Math.floor(i / W) - 1, 3, 3);
    },
  };
  function describeSwapped(o, list) {
    const e = list.find(l => l[0] === o); const keepM = o.material; o.material = e[1]; const d = describe(o); o.material = keepM; return d;
  }
})();
