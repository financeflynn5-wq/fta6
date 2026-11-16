// Loads self-contained glTF files (*.gltf.json: mesh data and textures stored inside the file as
// data: URIs), used for Flynn's guns and any other models shipped that way.
// The stock GLTFLoader fetches those data: URIs, and a hosted page with a strict security policy
// refuses such fetches, which silently leaves the game showing stand-ins. So the file is unpacked
// here instead: nothing below touches the network except reading the .gltf.json file itself.
import * as THREE from 'three';

const bytesOf = (uri) => { const bin = atob(uri.slice(uri.indexOf(',') + 1)), out = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i); return out; };
const pictureOf = (uri) => new Promise((ok, fail) => { const img = new Image(); img.onload = () => ok(img); img.onerror = fail; img.src = uri; });

async function readJson(url) {
  try { const r = await fetch(url); if (!r.ok) throw new Error(r.status); return await r.json(); }
  catch { return (await import(new URL(url, document.baseURI).href, { with: { type: 'json' } })).default; }   // fetch refused: load it the way scripts load
}

// Turn one self-contained .gltf.json into a three.js scene.
async function unpack(json, loader) {
  // 1. every buffer becomes one binary block, handed to the loader as a .glb so it has nothing to fetch
  const parts = (json.buffers || []).map(b => bytesOf(b.uri)), starts = []; let size = 0;
  for (const p of parts) { starts.push(size); size += Math.ceil(p.length / 4) * 4; }
  const bin = new Uint8Array(size); parts.forEach((p, i) => bin.set(p, starts[i]));
  const doc = { ...json, buffers: [{ byteLength: size }] };
  doc.bufferViews = (json.bufferViews || []).map(v => ({ ...v, buffer: 0, byteOffset: (v.byteOffset || 0) + starts[v.buffer || 0] }));
  // 2. textures are taken out and put back by hand afterwards
  const wanted = [];
  doc.materials = (json.materials || []).map((m, i) => {
    const pbr = { ...(m.pbrMetallicRoughness || {}) }, c = { ...m, pbrMetallicRoughness: pbr, extras: { ...(m.extras || {}), slot: i } };
    wanted[i] = { map: pbr.baseColorTexture, orm: pbr.metallicRoughnessTexture, normalMap: m.normalTexture, aoMap: m.occlusionTexture, emissiveMap: m.emissiveTexture };
    delete pbr.baseColorTexture; delete pbr.metallicRoughnessTexture; delete c.normalTexture; delete c.occlusionTexture; delete c.emissiveTexture;
    return c;
  });
  delete doc.images; delete doc.textures; delete doc.samplers;
  const text = new TextEncoder().encode(JSON.stringify(doc)), textLen = Math.ceil(text.length / 4) * 4;
  const glb = new ArrayBuffer(12 + 8 + textLen + 8 + size), dv = new DataView(glb), u8 = new Uint8Array(glb);
  dv.setUint32(0, 0x46546C67, true); dv.setUint32(4, 2, true); dv.setUint32(8, glb.byteLength, true);
  dv.setUint32(12, textLen, true); dv.setUint32(16, 0x4E4F534A, true); u8.fill(0x20, 20, 20 + textLen); u8.set(text, 20);
  dv.setUint32(20 + textLen, size, true); dv.setUint32(24 + textLen, 0x004E4942, true); u8.set(bin, 28 + textLen);
  const gltf = await loader.parseAsync(glb, '');

  // 3. decode each picture once and hang it on the materials that asked for it
  const made = new Map();
  const texture = async (ref, srgb) => {
    if (!ref) return null;
    const source = json.textures?.[ref.index]?.source, uri = json.images?.[source]?.uri; if (!uri) return null;
    const key = source + (srgb ? 's' : 'l');
    if (!made.has(key)) made.set(key, pictureOf(uri).then(img => {
      const t = new THREE.Texture(img); t.flipY = false; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
      if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.needsUpdate = true; return t;
    }).catch(() => null));               // a picture that won't decode leaves that gun plain rather than missing
    return made.get(key);
  };
  const mats = new Set(); gltf.scene.traverse(o => { if (o.isMesh) mats.add(o.material); });
  for (const m of mats) {
    const w = wanted[m.userData.slot]; if (!w) continue;
    const [map, orm, normalMap, aoMap, emissiveMap] = await Promise.all([texture(w.map, true), texture(w.orm, false), texture(w.normalMap, false), texture(w.aoMap, false), texture(w.emissiveMap, true)]);
    if (map) m.map = map; if (orm) m.roughnessMap = m.metalnessMap = orm; if (normalMap) m.normalMap = normalMap; if (aoMap) m.aoMap = aoMap; if (emissiveMap) m.emissiveMap = emissiveMap;
    m.needsUpdate = true;
  }
  return gltf;
}

// url: a .gltf.json file next to the page. loader: a GLTFLoader. Resolves to the usual { scene, ... }.
export const loadEmbeddedGltf = (url, loader) => readJson(url).then(json => unpack(json, loader));
