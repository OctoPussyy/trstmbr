// Loads the photoreal asset set: PBR textures (Poly Haven / ambientCG, CC0), HDR skies (Poly Haven, CC0) and scanned props (Poly Haven, CC0).
const Assets = (() => {
  const tex = {}, models = {}, skies = {}, envs = {};
  let total = 0, done = 0;
  const TL = new THREE.TextureLoader(), GL = new THREE.GLTFLoader(); GL.setMeshoptDecoder(THREE.MeshoptDecoder);
  const RL = new THREE.RGBELoader();
  const track = p => { total++; return p.then(v => { done++; return v; }, e => { done++; console.warn('asset failed', e && e.message); return null; }); };
  const loadT = (url, srgb) => new Promise((res, rej) => TL.load(url, t => { t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; res(t); }, undefined, rej));
  const TEX = ['road', 'sidewalk', 'curb', 'pavers', 'plaster', 'brick', 'concrete', 'roof', 'parquet', 'checker', 'bark', 'sand'];
  const MODELS = ['fire_hydrant', 'street_lamp_01', 'metal_trash_can', 'utility_box_01', 'korean_public_payphone_01', 'trashbag', 'cardboard_box_01', 'wooden_crate_02', 'rollershutter_door', 'water_manhole_cover',
    'boombox', 'service_pistol', 'sofa_02', 'ArmChair_01', 'coffee_table_round_01', 'television_02', 'gaming_console', 'steel_frame_shelves_01', 'wooden_display_shelves_01', 'potted_plant_02', 'BarberShopChair_01',
    'metal_office_desk', 'old_tyre', 'concrete_road_barrier_02', 'security_light', 'Barrel_01', 'bar_chair_round_01', 'plastic_crate_01'];
  const SKIES = ['dawn', 'noon', 'late_afternoon', 'dusk_2', 'night'];
  function loadEnv(name) {
    if (envs[name]) return envs[name];
    envs[name] = new Promise((res, rej) => RL.load('assets/env/' + name + '.hdr', t => { t.mapping = THREE.EquirectangularReflectionMapping; res(t); }, undefined, rej));
    return envs[name];
  }
  function loadAll(firstEnv) {
    const jobs = [];
    for (const n of TEX) {
      tex[n] = {};
      jobs.push(track(loadT(`assets/tex/${n}_diff.jpg`, true)).then(t => { tex[n].map = t; }));
      jobs.push(track(loadT(`assets/tex/${n}_nor.jpg`, false)).then(t => { tex[n].normal = t; }));
      jobs.push(track(loadT(`assets/tex/${n}_arm.jpg`, false)).then(t => { tex[n].arm = t; }));
    }
    for (const s of SKIES) jobs.push(track(loadT(`assets/sky/${s}.jpg`, true)).then(t => { if (t) { t.wrapT = THREE.ClampToEdgeWrapping; t.anisotropy = 4; } skies[s] = t; }));
    for (const m of MODELS) jobs.push(track(new Promise((res, rej) => GL.load(`assets/models/${m}.glb`, g => res(g.scene), undefined, rej))).then(s => { models[m] = s; }));
    jobs.push(track(loadEnv(firstEnv))); for (const s of SKIES) if (s !== firstEnv) jobs.push(track(loadEnv(s)));
    return Promise.all(jobs);
  }
  // quantized (int16 / normalized) glTF attributes -> plain float32 so the geometry can be transformed and merged
  function floatify(src) {
    const g = new THREE.BufferGeometry();
    for (const k in src.attributes) {
      const a = src.attributes[k], n = a.count, s = a.itemSize, arr = new Float32Array(n * s);
      for (let i = 0; i < n; i++) { arr[i * s] = a.getX(i); if (s > 1) arr[i * s + 1] = a.getY(i); if (s > 2) arr[i * s + 2] = a.getZ(i); if (s > 3) arr[i * s + 3] = a.getW(i); }
      g.setAttribute(k, new THREE.BufferAttribute(arr, s));
    }
    if (src.index) g.setIndex(new THREE.BufferAttribute(Uint32Array.from(src.index.array), 1));
    return g;
  }
  // geometry + material pairs of a model, optionally filtered by node name, positioned so the model stands on y=0 at its centre
  function parts(name, filter) {
    const root = models[name]; if (!root) return [];
    root.updateMatrixWorld(true);
    const out = [], box = new THREE.Box3();
    root.traverse(o => { if (o.isMesh && (!filter || filter(o.name, o))) { const g = floatify(o.geometry); g.applyMatrix4(o.matrixWorld); out.push({ geo: g, mat: o.material, name: o.name }); } });
    for (const p of out) { p.geo.computeBoundingBox(); box.union(p.geo.boundingBox); }
    const c = box.getCenter(new THREE.Vector3());
    for (const p of out) p.geo.translate(-c.x, -box.min.y, -c.z);
    return out;
  }
  return { loadAll, loadEnv, parts, tex, models, skies, envs, get progress() { return total ? done / total : 0; } };
})();
