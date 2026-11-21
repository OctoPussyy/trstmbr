// Procedural vehicles: extruded body silhouettes with wheel arches, clear-coat paint, tinted glass, chrome, spinning wheels.
const Cars = (() => {
  const K = 1 / 20;
  const SPEC = {
    sedan:    { L: 4.9, W: 1.86, ride: 0.22, belt: 0.98, hoodF: 0.86, trunkR: 0.98, roof: 1.45, ws: 0.72, rf: 0.0, rr: -0.95, bl: -1.55, wr: 0.34, wb: 2.85, tw: 0.24, rim: 'chrome' },
    taxi:     { L: 4.9, W: 1.86, ride: 0.22, belt: 0.98, hoodF: 0.86, trunkR: 0.98, roof: 1.45, ws: 0.72, rf: 0.0, rr: -0.95, bl: -1.55, wr: 0.34, wb: 2.85, tw: 0.24, rim: 'steel' },
    police:   { L: 5.1, W: 1.9, ride: 0.22, belt: 1.0, hoodF: 0.88, trunkR: 1.0, roof: 1.47, ws: 0.75, rf: 0.02, rr: -1.0, bl: -1.6, wr: 0.35, wb: 2.95, tw: 0.25, rim: 'steel' },
    lowrider: { L: 5.7, W: 2.0, ride: 0.11, belt: 0.84, hoodF: 0.78, trunkR: 0.84, roof: 1.3, ws: 0.5, rf: -0.25, rr: -1.2, bl: -1.85, wr: 0.33, wb: 3.15, tw: 0.22, rim: 'gold', ww: true, strip: true },
    van:      { L: 5.3, W: 2.0, ride: 0.26, belt: 1.12, hoodF: 1.0, trunkR: 2.05, roof: 2.15, ws: 1.55, rf: 1.05, rr: -2.55, bl: -2.6, wr: 0.37, wb: 3.2, tw: 0.26, rim: 'steel' },
    sport:    { L: 4.6, W: 1.96, ride: 0.13, belt: 0.79, hoodF: 0.68, trunkR: 0.86, roof: 1.18, ws: 0.82, rf: -0.12, rr: -0.75, bl: -1.55, wr: 0.35, wb: 2.65, tw: 0.29, rim: 'chrome' },
  };
  const tpl = {}, paint = {};
  const MAT = {};
  function mats() {
    if (MAT.glass) return;
    MAT.glass = new THREE.MeshPhysicalMaterial({ color: 0x0b1118, metalness: 0.1, roughness: 0.03, clearcoat: 1, clearcoatRoughness: 0.02, reflectivity: 0.9 });
    MAT.chrome = new THREE.MeshStandardMaterial({ color: 0xe8e8ec, metalness: 1, roughness: 0.12 });
    MAT.gold = new THREE.MeshStandardMaterial({ color: 0xe8b84a, metalness: 1, roughness: 0.18 });
    MAT.steel = new THREE.MeshStandardMaterial({ color: 0xa9adb3, metalness: 0.9, roughness: 0.3 });
    MAT.black = new THREE.MeshStandardMaterial({ color: 0x111214, metalness: 0.2, roughness: 0.55 });
    MAT.rubber = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.92 });
    MAT.white = new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.6 });
    MAT.head = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff3da, emissiveIntensity: 0.4, roughness: 0.1 });
    MAT.tail = new THREE.MeshStandardMaterial({ color: 0x550000, emissive: 0xff1010, emissiveIntensity: 0.6, roughness: 0.2 });
    MAT.brake = new THREE.MeshStandardMaterial({ color: 0x550000, emissive: 0xff1010, emissiveIntensity: 6, roughness: 0.2 });
    MAT.red = new THREE.MeshBasicMaterial({ color: new THREE.Color(8, 0.4, 0.4) }); MAT.redOff = new THREE.MeshBasicMaterial({ color: 0x400808 });
    MAT.blue = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.4, 0.8, 9) }); MAT.blueOff = new THREE.MeshBasicMaterial({ color: 0x080a40 });
    MAT.taxiSign = new THREE.MeshStandardMaterial({ map: Gfx.tex(128, 48, (x, w, h) => { x.fillStyle = '#ffd400'; x.fillRect(0, 0, w, h); x.fillStyle = '#111'; x.font = '900 30px Arial Black, Impact'; x.textAlign = 'center'; x.fillText('TAXI', w / 2, 36); }), emissive: 0xffffff, emissiveIntensity: 0.4 });
    MAT.taxiSign.emissiveMap = MAT.taxiSign.map;
    MAT.plate = new THREE.MeshStandardMaterial({ map: Gfx.tex(128, 64, (x, w, h) => { x.fillStyle = '#f4f4ee'; x.fillRect(0, 0, w, h); x.strokeStyle = '#1e3a8a'; x.lineWidth = 4; x.strokeRect(3, 3, w - 6, h - 6); x.fillStyle = '#1e3a8a'; x.font = '900 28px Arial'; x.textAlign = 'center'; x.fillText('CATZ90', w / 2, 44); x.font = '700 10px Arial'; x.fillText('SUNSHINE STATE', w / 2, 14); }), roughness: 0.5 });
    MAT.pool = new THREE.MeshBasicMaterial({ map: Gfx.radial([[0, 'rgba(255,240,210,.9)'], [0.5, 'rgba(255,230,190,.35)'], [1, 'rgba(255,220,170,0)']]), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 });
  }
  function paintMat(color, type) {
    const k = color + type; if (paint[k]) return paint[k];
    const candy = type === 'lowrider';
    return paint[k] = new THREE.MeshPhysicalMaterial({ color, metalness: candy ? 0.75 : 0.45, roughness: candy ? 0.22 : 0.32, clearcoat: 1, clearcoatRoughness: 0.04 });
  }
  const box = (w, h, d, x, y, z, rad) => { const g = rad ? new THREE.RoundedBoxGeometry(w, h, d, 2, rad) : new THREE.BoxGeometry(w, h, d); g.translate(x, y, z); return g; };
  function bodyGeo(s) {
    const L = s.L, h = L / 2, sh = new THREE.Shape(), rA = s.wr + 0.07;
    sh.moveTo(-h + 0.3, s.ride);
    for (const xw of [-s.wb / 2, s.wb / 2]) { sh.lineTo(xw - rA, s.ride); sh.lineTo(xw - rA, s.wr); sh.absarc(xw, s.wr, rA, Math.PI, 0, true); sh.lineTo(xw + rA, s.ride); }
    sh.lineTo(h - 0.3, s.ride); sh.quadraticCurveTo(h, s.ride, h, s.ride + 0.3); sh.lineTo(h, s.hoodF - 0.14); sh.quadraticCurveTo(h, s.hoodF, h - 0.35, s.hoodF);
    sh.lineTo(s.ws + 0.06, s.belt); sh.lineTo(s.bl, s.belt);
    if (s.trunkR > s.belt + 0.3) { sh.lineTo(-h + 0.1, s.trunkR); } else { sh.lineTo(-h + 0.35, s.trunkR); sh.quadraticCurveTo(-h, s.trunkR, -h, s.trunkR - 0.16); }
    sh.lineTo(-h, s.ride + 0.3); sh.quadraticCurveTo(-h, s.ride, -h + 0.3, s.ride);
    const bev = 0.07, g = new THREE.ExtrudeGeometry(sh, { depth: s.W - bev * 2, bevelEnabled: true, bevelThickness: bev, bevelSize: bev, bevelSegments: 3, curveSegments: 10 });
    g.translate(0, 0, -(s.W - bev * 2) / 2);
    const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), k = Math.max(0, (Math.abs(x) - (h - 0.7)) / 0.7); p.setZ(i, p.getZ(i) * (1 - 0.08 * k * k)); }
    g.computeVertexNormals(); return g;
  }
  function greenhouseGeo(s) {
    const sh = new THREE.Shape(); sh.moveTo(s.ws, s.belt); sh.lineTo(s.rf, s.roof); sh.lineTo(s.rr, s.roof); sh.lineTo(s.bl, s.belt); sh.lineTo(s.ws, s.belt);
    const W = s.W * 0.86, g = new THREE.ExtrudeGeometry(sh, { depth: W - 0.08, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 2, curveSegments: 4 });
    g.translate(0, 0, -(W - 0.08) / 2);
    const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const t = Math.max(0, Math.min(1, (p.getY(i) - s.belt) / (s.roof - s.belt))); p.setZ(i, p.getZ(i) * (1 - 0.13 * t)); }
    g.computeVertexNormals(); return g;
  }
  function pillar(x0, y0, x1, y1, z, w) { const len = Math.hypot(x1 - x0, y1 - y0), g = new THREE.BoxGeometry(len + 0.04, w, 0.07); g.rotateZ(Math.atan2(y1 - y0, x1 - x0)); g.translate((x0 + x1) / 2, (y0 + y1) / 2, z); return g; }
  function wheelGeo(s) {
    const r = s.wr, w = s.tw, parts = [[], []];
    const tire = new THREE.CylinderGeometry(r, r, w, 30, 1); tire.rotateX(Math.PI / 2); parts[0].push(tire);
    for (const z of [-w / 2, w / 2]) { const t = new THREE.TorusGeometry(r - 0.035, 0.04, 6, 30); t.translate(0, 0, z * 0.92); parts[0].push(t); }
    const rim = new THREE.CylinderGeometry(r * 0.64, r * 0.64, w + 0.012, 24, 1, true); rim.rotateX(Math.PI / 2); parts[1].push(rim);
    const face = new THREE.CircleGeometry(r * 0.64, 24); face.translate(0, 0, w / 2 + 0.004); parts[1].push(face);
    const nSp = s.rim === 'gold' ? 18 : 6; for (let k = 0; k < nSp; k++) { const sp = new THREE.BoxGeometry(r * 1.2, s.rim === 'gold' ? 0.012 : 0.06, 0.03); sp.rotateZ(k / nSp * Math.PI); sp.translate(0, 0, w / 2 + 0.02); parts[1].push(sp); }
    const hub = new THREE.CylinderGeometry(r * 0.16, r * 0.2, 0.06, 12); hub.rotateX(Math.PI / 2); hub.translate(0, 0, w / 2 + 0.04); parts[1].push(hub);
    if (s.ww) { const ring = new THREE.RingGeometry(r * 0.66, r * 0.88, 30); ring.translate(0, 0, w / 2 + 0.006); parts.push([ring]); }
    const merged = parts.map(list => THREE.BufferGeometryUtils.mergeGeometries(list.map(g => g.index ? g.toNonIndexed() : g)));
    return THREE.BufferGeometryUtils.mergeGeometries(merged, true);
  }
  function template(type) {
    if (tpl[type]) return tpl[type];
    mats(); const s = SPEC[type] || SPEC.sedan, L = s.L, h = L / 2, W = s.W, G = { paint: [], glass: [], chrome: [], black: [], head: [], tail: [], plate: [], white: [] };
    G.paint.push(bodyGeo(s));
    G.glass.push(greenhouseGeo(s));
    const gw = W * 0.86 * (1 - 0.13), rw = gw - 0.02;
    G.paint.push(box(s.rf - s.rr + 0.12, 0.06, rw, (s.rf + s.rr) / 2, s.roof + 0.02, 0, 0.025));
    for (const z of [-1, 1]) {
      const zz = z * (W * 0.86 / 2 - 0.02);
      G.paint.push(pillar(s.ws, s.belt, s.rf, s.roof, zz * 0.97, 0.09), pillar(s.bl, s.belt, s.rr, s.roof, zz * 0.97, 0.16));
      if (type !== 'sport') G.black.push(box(0.12, s.roof - s.belt - 0.06, 0.02, (s.rf + s.rr) / 2 + 0.05, (s.belt + s.roof) / 2, zz * 0.94 + z * 0.02));
      G.black.push(box(0.012, s.belt - s.ride - 0.2, 0.01, s.ws - 0.1, (s.belt + s.ride) / 2 + 0.05, z * (W / 2 + 0.001)), box(0.012, s.belt - s.ride - 0.2, 0.01, (s.rf + s.rr) / 2 + 0.05, (s.belt + s.ride) / 2 + 0.05, z * (W / 2 + 0.001)));
      G.paint.push(box(0.2, 0.1, 0.16, s.ws - 0.05, s.belt + 0.08, z * (W / 2 + 0.05), 0.03));                   // mirrors
      G.chrome.push(box(0.05, 0.03, 0.18, (s.ws + s.bl) / 2 + 0.2, s.belt - 0.15, z * (W / 2 + 0.002)));        // door handles
      if (s.strip) G.chrome.push(box(L * 0.86, 0.035, 0.01, 0, s.belt - 0.06, z * (W / 2 + 0.006)));
      G.head.push(box(0.06, 0.16, 0.36, h - 0.02, s.hoodF - 0.26, z * (W / 2 - 0.32), 0.03));
      G.tail.push(box(0.06, 0.16, type === 'lowrider' ? 0.2 : 0.42, -h + 0.02, Math.min(s.trunkR, s.belt) - 0.22, z * (W / 2 - 0.3), 0.03));
    }
    const chromeB = type === 'lowrider' || type === 'sedan' || type === 'taxi';
    (chromeB ? G.chrome : G.black).push(box(0.16, 0.2, W * 0.98, h + 0.02, s.ride + 0.24, 0, 0.06), box(0.16, 0.2, W * 0.98, -h - 0.02, s.ride + 0.24, 0, 0.06));
    G.black.push(box(0.04, 0.24, W * 0.5, h + 0.005, s.hoodF - 0.3, 0, 0.02)); G.chrome.push(box(0.03, 0.03, W * 0.52, h + 0.02, s.hoodF - 0.17, 0));
    G.plate.push(box(0.02, 0.15, 0.32, -h - 0.11, s.ride + 0.45, 0));
    if (type === 'police') { for (const z of [-1, 1]) G.white.push(box(s.ws - s.bl - 0.3, s.belt - s.ride - 0.28, 0.02, (s.ws + s.bl) / 2 - 0.05, (s.belt + s.ride) / 2 + 0.02, z * (W / 2 + 0.004))); G.black.push(box(0.12, 0.42, W * 0.6, h + 0.18, s.ride + 0.36, 0), box(0.5, 0.1, W * 0.75, (s.rf + s.rr) / 2, s.roof + 0.1, 0)); }
    if (type === 'van') G.black.push(box(0.012, s.roof - s.ride - 0.4, 0.01, -0.6, (s.roof + s.ride) / 2, W / 2 + 0.002));
    const out = { s, geos: {} };
    for (const k in G) if (G[k].length) out.geos[k] = THREE.BufferGeometryUtils.mergeGeometries(G[k].map(g => g.index ? g.toNonIndexed() : g));
    out.wheel = wheelGeo(s);
    return tpl[type] = out;
  }
  const views = new Map();
  function build(c) {
    const T = template(c.type), s = T.s, g = new THREE.Group(), body = new THREE.Group(); g.add(body);
    const kx = (c.len * K) / s.L; body.scale.set(kx, 1, 1);
    const pm = paintMat(c.type === 'police' ? '#0f1012' : c.color, c.type);
    const meshes = {};
    for (const k in T.geos) { const m = new THREE.Mesh(T.geos[k], k === 'paint' ? pm : MAT[k]); m.castShadow = k !== 'head' && k !== 'tail' && k !== 'plate'; m.receiveShadow = true; body.add(m); meshes[k] = m; }
    const rimM = MAT[s.rim] || MAT.chrome, wheels = [];
    for (const [x, z] of [[s.wb / 2, 1], [s.wb / 2, -1], [-s.wb / 2, 1], [-s.wb / 2, -1]]) {
      const pivot = new THREE.Group(); pivot.position.set(x * kx, s.wr, z * (s.W / 2 - s.tw / 2 + 0.03)); if (z < 0) pivot.scale.z = -1;
      const w = new THREE.Mesh(T.wheel, s.ww ? [MAT.rubber, rimM, MAT.white] : [MAT.rubber, rimM]); w.castShadow = true; pivot.add(w); g.add(pivot); wheels.push({ pivot, w, front: x > 0 });
    }
    let bar = null;
    if (c.type === 'police') { bar = { r: new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.13, s.W * 0.33), MAT.red), b: new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.13, s.W * 0.33), MAT.blue) }; const y = s.roof + 0.2, x = (s.rf + s.rr) / 2; bar.r.position.set(x, y, -s.W * 0.18); bar.b.position.set(x, y, s.W * 0.18); body.add(bar.r, bar.b); }
    if (c.type === 'taxi') { const t = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.24, 0.8), MAT.taxiSign); t.position.set((s.rf + s.rr) / 2, s.roof + 0.15, 0); body.add(t); }
    const pool = new THREE.Mesh(new THREE.PlaneGeometry(9, 5).rotateX(-Math.PI / 2), MAT.pool); pool.position.set(s.L / 2 * kx + 4.5, 0.03, 0); g.add(pool);
    return { g, body, meshes, wheels, bar, spin: 0, wrecked: false, s, kx, pm };
  }
  const wreckMat = new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.9 });
  function sync(root, cars, time, dark, cam) {
    mats(); const seen = new Set(), dt = 1 / 60;
    MAT.head.emissiveIntensity = 0.4 + dark * 5; MAT.tail.emissiveIntensity = 0.6 + dark * 2.4; MAT.pool.opacity = Math.max(0, (dark - 0.25) * 1.2); MAT.taxiSign.emissiveIntensity = 0.4 + dark * 2;
    for (const c of cars) {
      let v = views.get(c); if (!v) { v = build(c); views.set(c, v); root.add(v.g); }
      seen.add(c);
      v.g.position.set(c.x * K, 0, c.y * K); v.g.rotation.y = -c.a;
      const cd = cam ? Math.hypot(cam.x - c.x * K, cam.z - c.y * K) : 0, lod = cd > 160 ? 2 : cd > 70 ? 1 : 0;
      if (lod !== v.lod) { v.lod = lod; v.g.visible = lod < 2; for (const w of v.wheels) w.pivot.visible = lod === 0; for (const k2 of ['plate', 'black', 'chrome']) if (v.meshes[k2]) v.meshes[k2].visible = lod === 0; for (const k2 in v.meshes) v.meshes[k2].castShadow = lod === 0 && k2 !== 'head' && k2 !== 'tail' && k2 !== 'plate'; }
      if (lod === 2) continue;
      const sp = c.speedF || 0;
      v.body.rotation.x = Math.max(-0.05, Math.min(0.05, -c.av * sp * 0.00035));            // body roll in corners
      v.body.rotation.z = Math.max(-0.035, Math.min(0.035, (c.brake > 0.2 && sp > 20 ? -0.03 : 0) + (c.thr > 0 && sp < 200 ? 0.012 : 0)));
      v.body.position.y = c.type === 'lowrider' && !c.wreck ? Math.sin(time * 2.2 + c.x) * 0.025 + 0.01 : 0;
      v.spin += sp * K / v.s.wr * dt;
      for (const w of v.wheels) { w.w.rotation.z = -v.spin; if (w.front) w.pivot.rotation.y = -(c.steer || 0) * 0.42; }
      if (v.meshes.tail) v.meshes.tail.material = (c.brake > 0.2 || sp < -5) && !c.wreck ? MAT.brake : MAT.tail;
      if (v.bar) { const f = Math.floor(time * 7) % 2, on = c.driver === 'cop'; v.bar.r.material = on && f ? MAT.red : MAT.redOff; v.bar.b.material = on && !f ? MAT.blue : MAT.blueOff; }
      if (c.wreck && !v.wrecked) { v.wrecked = true; if (v.meshes.paint) v.meshes.paint.material = wreckMat; if (v.meshes.glass) v.meshes.glass.visible = false; }
    }
    for (const [c, v] of views) if (!seen.has(c)) { root.remove(v.g); views.delete(c); }
  }
  return { sync, SPEC, template };
})();
