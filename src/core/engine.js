// Renderer, scene, camera and the post-processing chain (same setup as the concept).
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';

export function createEngine(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 16 / 9, 0.3, 1500);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;

  const rt = new THREE.WebGLRenderTarget(16, 16, { type: THREE.HalfFloatType, samples: 4 });
  const composer = new EffectComposer(renderer, rt);
  composer.addPass(new RenderPass(scene, camera));
  const gtao = new GTAOPass(scene, camera, 16, 16);
  gtao.updateGtaoMaterial({ radius: 1.6, distanceExponent: 1.5, thickness: 2, scale: 1.1, samples: 16 });
  gtao.blendIntensity = .9; composer.addPass(gtao);
  const bloom = new UnrealBloomPass(new THREE.Vector2(16, 16), .2, .4, 1.4); composer.addPass(bloom);
  composer.addPass(new OutputPass());

  const engine = {
    renderer, scene, camera, composer, bloom, gtao, quality: 'high', sun: null,
    setQuality(q) {
      engine.quality = q; gtao.enabled = q === 'high';
      renderer.shadowMap.type = q === 'high' ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
      if (engine.sun) {
        engine.sun.shadow.mapSize.setScalar(q === 'high' ? 4096 : 2048);
        if (engine.sun.shadow.map) { engine.sun.shadow.map.dispose(); engine.sun.shadow.map = null; }
      }
      scene.traverse(o => { if (o.material) [].concat(o.material).forEach(m => m.needsUpdate = true); });
      engine.resize();
    },
    resize() {
      const w = window.innerWidth, h = window.innerHeight, pr = Math.min(devicePixelRatio, engine.quality === 'high' ? 1.75 : 1);
      renderer.setPixelRatio(pr); renderer.setSize(w, h, false); composer.setPixelRatio(pr); composer.setSize(w, h);
      camera.aspect = w / h; camera.updateProjectionMatrix();
    },
    render() { composer.render(); },
  };
  window.addEventListener('resize', engine.resize);
  return engine;
}
