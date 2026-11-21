// Shop and safehouse interiors, furnished with photoscanned Poly Haven models and PBR surfaces.
// Rooms live far outside the city; positions are sim px like everywhere else.
const Interior = (() => {
  const K = Gfx.K, IX = -14000, IY = -14000;
  const cache = {};
  let cur = null;
  const ROOMS = {
    bodega:  { name: 'BODEGA', w: 14, d: 10, wall: '#cfe3d4', accent: 'brick', floor: 'checker', neon: ['BODEGA', '#3ef2a0'], clerk: { char: 'pimp_daddy', hue: 80, x: 7, z: 1.8, name: 'MR. WHISKERS' }, shop: 'bodega', light: 0xfff2dc },
    pawn:    { name: 'PAWN SHOP', w: 14, d: 10, wall: '#b9a58c', accent: 'brick', floor: 'curb', neon: ['PAWN · GOLD · GUNS', '#ffd23f'], clerk: { char: 'crimson_paw', hue: 200, x: 7, z: 1.8, name: 'BIG TONE' }, shop: 'pawn', light: 0xffe2b8 },
    fits:    { name: 'FRESH FITS', w: 15, d: 10, wall: '#f3d2e6', accent: 'concrete', floor: 'parquet', neon: ['FRESH FITS', '#ff4fd8'], clerk: { char: 'prison', hue: 280, x: 11.5, z: 2.0, name: 'LADY LYNX' }, shop: 'fits', light: 0xfff0f4 },
    records: { name: 'RECORD SPOT', w: 13, d: 10, wall: '#c9c2e8', accent: 'brick', floor: 'parquet', neon: ['RECORDS', '#c78bff'], clerk: { char: 'crimson_paw', hue: 270, x: 9.5, z: 2.0, name: 'DJ PURRSON' }, shop: 'records', light: 0xffe6c8 },
    home:    { name: 'SAFEHOUSE', w: 12, d: 9, wall: '#e8e0d4', accent: 'brick', floor: 'parquet', neon: ['HOME', '#4fc3ff'], clerk: null, shop: 'home', light: 0xffe0b8 },
  };
  const hex = h => new THREE.Color(h);
  function pbr(set, color, extra) { const t = Assets.tex[set]; return new THREE.MeshStandardMaterial(Object.assign({ map: t.map, normalMap: t.normal, roughnessMap: t.arm, color: color || 0xffffff, roughness: 1 }, extra || {})); }
  function scaleUV(g, su, sv) { const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv); return g; }
  const neonTex = (txt, c) => Gfx.tex(1024, 192, (x, w, h) => {
    x.clearRect(0, 0, w, h); let fs = 120; x.font = `900 ${fs}px "Arial Black", Impact, sans-serif`; while (x.measureText(txt).width > w - 60 && fs > 30) { fs -= 6; x.font = `900 ${fs}px "Arial Black", Impact, sans-serif`; }
    x.textAlign = 'center'; x.textBaseline = 'middle'; x.shadowColor = c; x.shadowBlur = 26; x.strokeStyle = c; x.lineWidth = 6; x.strokeText(txt, w / 2, h / 2 + 6); x.fillStyle = '#fff'; x.fillText(txt, w / 2, h / 2 + 6);
  });
  const posterTex = (i) => Gfx.tex(256, 360, (x, w, h) => {
    const bg = ['#e11d48', '#1e1b4b', '#065f46', '#7c2d12', '#312e81'][i % 5], fg = ['#fde68a', '#ff4fd8', '#fde047', '#38bdf8', '#3ef2a0'][i % 5];
    const g = x.createLinearGradient(0, 0, w, h); g.addColorStop(0, bg); g.addColorStop(1, '#000'); x.fillStyle = g; x.fillRect(0, 0, w, h);
    x.fillStyle = fg; x.font = 'italic 900 52px "Arial Black", Impact'; x.textAlign = 'center'; x.fillText(['BOOM', 'BAP', 'CATZ', 'G-FUNK', '1994'][i % 5], w / 2, 120);
    x.font = '700 22px Arial'; x.fillStyle = '#fff'; x.fillText(['LIVE @ THE WHARF', 'MIXTAPE VOL. 3', 'IN DA HOOD', 'SUNSET JAM', 'BLOCK PARTY'][i % 5], w / 2, 170);
    x.strokeStyle = fg; x.lineWidth = 6; x.strokeRect(14, 14, w - 28, h - 28); x.beginPath(); x.arc(w / 2, 260, 56, 0, 7); x.stroke();
  });
  const productTex = () => Gfx.tex(256, 128, (x, w, h) => { const pal = ['#e11d48', '#facc15', '#38bdf8', '#22c55e', '#f97316', '#a855f7', '#f43f5e', '#ffffff']; for (let i = 0; i < 16; i++) { x.fillStyle = pal[(i * 5) % 8]; x.fillRect(i * 16, 0, 14, h); x.fillStyle = 'rgba(255,255,255,.5)'; x.fillRect(i * 16 + 2, 20, 10, 18); x.fillStyle = 'rgba(0,0,0,.25)'; x.fillRect(i * 16, h - 12, 14, 12); } });

  function build(key) {
    if (cache[key]) return cache[key];
    const r = ROOMS[key], g = new THREE.Group(), cols = [], acts = [], npcs = [];
    const W = r.w, D = r.d, H = 3.6, ox = IX * K, oz = IY * K;
    const add = (o, x, y, z, ry) => { o.position.set(x + ox, y, z + oz); if (ry) o.rotation.y = ry; g.add(o); o.traverse(m => { if (m.isMesh) { m.castShadow = false; m.receiveShadow = true; } }); return o; };
    const solid = (x, z, w, d) => cols.push([x - w / 2, z - d / 2, x + w / 2, z + d / 2]);
    const boxMesh = (w, h, d, mat, tile) => { const geo = new THREE.BoxGeometry(w, h, d); if (tile) { const uv = geo.attributes.uv; const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]]; for (let i = 0; i < uv.count; i++) { const f = dims[Math.floor(i / 4)]; uv.setXY(i, uv.getX(i) * f[0] / tile, uv.getY(i) * f[1] / tile); } } return new THREE.Mesh(geo, mat); };
    const model = (name, x, y, z, ry, s, filter) => { const grp = new THREE.Group(); for (const p of Assets.parts(name, filter)) grp.add(new THREE.Mesh(p.geo, p.mat)); grp.scale.setScalar(s || 1); return add(grp, x, y, z, ry); };
    // shell
    const floorMat = pbr(r.floor, r.floor === 'curb' ? 0x9a948c : 0xffffff);
    add(new THREE.Mesh(scaleUV(new THREE.PlaneGeometry(W, D).rotateX(-Math.PI / 2), W / 2.5, D / 2.5), floorMat), W / 2, 0, D / 2);
    add(new THREE.Mesh(scaleUV(new THREE.PlaneGeometry(W, D).rotateX(Math.PI / 2), W / 3, D / 3), pbr('plaster', 0xf4f1ea)), W / 2, H, D / 2);
    const wallMat = pbr('plaster', hex(r.wall)), accentMat = pbr(r.accent, r.accent === 'brick' ? 0xffffff : 0xe8e4dc);
    const wall = (w, x, z, ry, mat) => add(new THREE.Mesh(scaleUV(new THREE.PlaneGeometry(w, H), w / 3, H / 3), mat), x, H / 2, z, ry);
    wall(W, W / 2, 0, 0, accentMat); wall(W, W / 2, D, Math.PI, wallMat); wall(D, 0, D / 2, Math.PI / 2, wallMat); wall(D, W, D / 2, -Math.PI / 2, wallMat);
    const trim = new THREE.MeshStandardMaterial({ color: 0x2a2420, roughness: 0.6 });
    for (const [w, x, z, ry] of [[W, W / 2, 0.02, 0], [W, W / 2, D - 0.02, Math.PI], [D, 0.02, D / 2, Math.PI / 2], [D, W - 0.02, D / 2, -Math.PI / 2]]) add(boxMesh(w, 0.12, 0.03, trim), x, 0.06, z, ry);
    // ceiling light panels (bloom) + real lights from the shared pool
    const panel = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: hex(r.light), emissiveIntensity: 1.8 });
    for (const [x, z] of [[W * 0.3, D * 0.35], [W * 0.7, D * 0.35], [W * 0.3, D * 0.72], [W * 0.7, D * 0.72]]) add(boxMesh(1.8, 0.05, 0.5, panel), x, H - 0.03, z);
    const lights = [[W * 0.35 + ox, H - 0.6, D * 0.4 + oz, r.light, 16], [W * 0.68 + ox, H - 0.6, D * 0.65 + oz, r.light, 13]];
    // neon sign on the back wall
    const neonMat = new THREE.MeshBasicMaterial({ map: neonTex(r.neon[0], r.neon[1]), transparent: true, depthWrite: false, color: new THREE.Color(2.2, 2.2, 2.2) });
    add(new THREE.Mesh(new THREE.PlaneGeometry(4.8, 0.9), neonMat), W / 2, 2.75, 0.05);
    // exit door
    const doorM = new THREE.MeshStandardMaterial({ color: 0x0d151d, roughness: 0.05, metalness: 0.9 });
    add(boxMesh(1.9, 2.4, 0.06, doorM), W / 2, 1.2, D - 0.03); add(boxMesh(2.1, 0.12, 0.1, trim), W / 2, 2.45, D - 0.05);
    add(new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.04).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 2.6, 2) })), W / 2, 0.01, D - 0.3);
    const exitSign = new THREE.MeshBasicMaterial({ map: Gfx.tex(128, 48, (x, w, h) => { x.fillStyle = '#062'; x.fillRect(0, 0, w, h); x.fillStyle = '#7f7'; x.font = '900 30px Arial'; x.textAlign = 'center'; x.fillText('EXIT', w / 2, 35); }), color: new THREE.Color(2, 2, 2) });
    add(new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.19), exitSign), W / 2, 2.8, D - 0.04, Math.PI);
    // posters
    for (let i = 0; i < 3; i++) add(new THREE.Mesh(new THREE.PlaneGeometry(0.75, 1.05), new THREE.MeshStandardMaterial({ map: posterTex(i + key.length), roughness: 0.7 })), 0.03, 1.7, 2.4 + i * 2.1, Math.PI / 2);
    const prod = new THREE.MeshStandardMaterial({ map: productTex(), roughness: 0.6 }), wood = new THREE.MeshStandardMaterial({ color: 0x6b4a32, roughness: 0.7 }), glassTop = new THREE.MeshPhysicalMaterial({ color: 0xbfd9e6, roughness: 0.05, metalness: 0, transmission: 0, opacity: 0.35, transparent: true });
    const counter = (x, z, w) => { add(boxMesh(w, 1.0, 0.8, wood), x, 0.5, z); add(boxMesh(w + 0.06, 0.06, 0.86, pbr('concrete', 0xdddddd)), x, 1.03, z); solid(x, z, w, 0.8); };
    const shelfWall = (x, z, len, ry) => { const grp = new THREE.Group(); for (let k = 0; k < 4; k++) { const s = boxMesh(len, 0.04, 0.45, wood); s.position.set(0, 0.35 + k * 0.5, 0); grp.add(s); const pr = boxMesh(len - 0.1, 0.3, 0.3, prod); pr.position.set(0, 0.53 + k * 0.5, 0); grp.add(pr); } const back = boxMesh(len, 2.2, 0.04, wood); back.position.set(0, 1.1, -0.22); grp.add(back); add(grp, x, 0, z, ry); };
    if (key === 'bodega') {
      counter(7, 2.8, 5.5); model('television_02', 8.8, 1.06, 2.8, Math.PI, 1);
      shelfWall(1.0, 5.5, 5, Math.PI / 2); solid(1.0, 5.5, 0.5, 5); shelfWall(W - 1.0, 5.5, 5, -Math.PI / 2); solid(W - 1.0, 5.5, 0.5, 5);
      for (const x of [4.6, 9.4]) { add(boxMesh(3.2, 1.5, 0.9, wood), x, 0.75, 6.2); for (const s of [-1, 1]) { const pr = boxMesh(3.0, 0.32, 0.28, prod); add(pr, x, 1.0 + (s > 0 ? 0.35 : 0), 6.2 + s * 0.3); } solid(x, 6.2, 3.2, 0.9); }
      const fridge = new THREE.MeshStandardMaterial({ color: 0xdfefff, emissive: 0xbfe6ff, emissiveIntensity: 1.6 }); add(boxMesh(2.6, 2.2, 0.7, new THREE.MeshStandardMaterial({ color: 0xd8d8d8, metalness: 0.6, roughness: 0.3 })), 3, 1.1, 0.45); add(boxMesh(2.4, 1.9, 0.02, fridge), 3, 1.1, 0.81); solid(3, 0.45, 2.6, 0.7);
      for (let k = 0; k < 4; k++) model('plastic_crate_01', 11.5 + (k % 2) * 0.45, (k > 1 ? 0.27 : 0), 0.6, 0, 1.1);
      model('cardboard_box_01', 12.8, 0, 1.4, 0.4, 1.3);
      acts.push({ x: 7, z: 3.9, r: 2.4, label: 'Talk to the clerk', kind: 'shop' });
    } else if (key === 'pawn') {
      counter(7, 2.8, 6); add(boxMesh(5.8, 0.02, 0.7, glassTop), 7, 1.07, 2.8);
      const board = new THREE.MeshStandardMaterial({ color: 0x3a2f25, roughness: 0.9 }); add(boxMesh(6, 1.4, 0.04, board), 7, 1.9, 0.05);
      for (let k = 0; k < 6; k++) model('service_pistol', 4.8 + k * 0.9, 1.75 + (k % 2) * 0.45, 0.12, 0, 1.2, n => n.endsWith('_a') && !n.includes('magazine'));
      model('boombox', 4.6, 1.06, 2.8, 0.2, 1); model('gaming_console', 9.2, 1.07, 2.8, 0.3, 1.2); model('television_02', 12.4, 0, 1.0, -0.4, 1.4);
      model('steel_frame_shelves_01', 1.2, 0, 6, Math.PI / 2, 0.1); solid(1.2, 6, 0.6, 1.2); model('steel_frame_shelves_01', W - 1.2, 0, 6, -Math.PI / 2, 0.1); solid(W - 1.2, 6, 0.6, 1.2);
      model('old_tyre', 1.3, 0, 8.4, 0.6, 1.3); model('Barrel_01', W - 1.2, 0, 8.4, 0, 1); solid(W - 1.2, 8.4, 0.6, 0.6);
      model('metal_office_desk', 11.5, 0, 6.5, Math.PI / 2, 1); solid(11.5, 6.5, 1, 2);
      acts.push({ x: 7, z: 3.9, r: 2.4, label: 'Talk to Big Tone', kind: 'shop' });
    } else if (key === 'fits') {
      counter(11.5, 3.0, 3.2);
      const chrome = new THREE.MeshStandardMaterial({ color: 0xdddddd, metalness: 1, roughness: 0.15 }), cloth = ['#ff4fd8', '#ffd23f', '#3ec8ff', '#7c3aed', '#22c55e', '#111111', '#f1f1f1'];
      for (let rk = 0; rk < 3; rk++) { const x = 2.5 + rk * 3.0; add(boxMesh(2.4, 0.04, 0.04, chrome), x, 1.55, 6.3); for (const s of [-1.15, 1.15]) add(boxMesh(0.04, 1.55, 0.04, chrome), x + s, 0.78, 6.3); for (let k = 0; k < 9; k++) add(boxMesh(0.06, 0.85, 0.55, new THREE.MeshStandardMaterial({ color: cloth[(k + rk) % cloth.length], roughness: 0.95 })), x - 1.0 + k * 0.25, 1.1, 6.3); solid(x, 6.3, 2.4, 0.6); }
      add(new THREE.Mesh(new THREE.PlaneGeometry(1.4, 2.4), new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 1, roughness: 0.02 })), 0.04, 1.4, 6.6, Math.PI / 2);
      model('BarberShopChair_01', 2.4, 0, 2.2, Math.PI * 0.75, 1.1); solid(2.4, 2.2, 1, 1);
      model('potted_plant_02', W - 0.8, 0, D - 1.2, 0, 1.4); model('bar_chair_round_01', 10.2, 0, 3.8, 0, 1);
      acts.push({ x: 11, z: 4.2, r: 2.6, label: 'Talk to Lady Lynx', kind: 'shop' });
    } else if (key === 'records') {
      counter(9.5, 2.9, 4.2); model('boombox', 8.4, 1.06, 2.9, 0, 1);
      const disc = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.25, metalness: 0.2 }); const tt = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.02, 32), disc); add(tt, 10.6, 1.1, 2.9);
      const sleeves = new THREE.MeshStandardMaterial({ map: productTex(), roughness: 0.7 });
      for (let k = 0; k < 4; k++) { const x = 2.2 + k * 2.3; model('wooden_crate_02', x, 0, 6.2, Math.PI / 2, 1.5); add(boxMesh(0.7, 0.32, 0.72, sleeves), x, 0.68, 6.2); solid(x, 6.2, 1.7, 0.9); }
      const spk = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.5 }); for (const x of [0.6, W - 0.6]) { add(boxMesh(0.8, 1.6, 0.7, spk), x, 0.8, 1.2); solid(x, 1.2, 0.8, 0.7); }
      model('wooden_display_shelves_01', W - 0.4, 0, 6, -Math.PI / 2, 1.2); solid(W - 0.4, 6, 0.5, 1.3);
      acts.push({ x: 9.5, z: 4.0, r: 2.4, label: 'Talk to DJ Purrson', kind: 'shop' });
    } else if (key === 'home') {
      model('sofa_02', 2.6, 0, 6.8, 0, 1.3); solid(2.6, 6.8, 2.4, 1.1); model('ArmChair_01', 5.2, 0, 5.8, -Math.PI / 2 - 0.3, 1.05); solid(5.2, 5.8, 0.9, 0.9);
      model('coffee_table_round_01', 2.8, 0, 4.9, 0, 0.9); solid(2.8, 4.9, 1.1, 1.1);
      add(boxMesh(2.2, 0.55, 0.5, wood), 2.6, 0.28, 0.4); solid(2.6, 0.4, 2.2, 0.5); model('television_02', 2.2, 0.56, 0.4, 0, 1.7); model('gaming_console', 3.3, 0.56, 0.45, 0.2, 1.1);
      const sheet = new THREE.MeshStandardMaterial({ color: 0x3b4a7a, roughness: 0.95 }), pillow = new THREE.MeshStandardMaterial({ color: 0xf1ede6, roughness: 0.95 });
      add(boxMesh(2.0, 0.35, 2.3, wood), W - 1.6, 0.18, 1.6); add(boxMesh(1.95, 0.22, 2.2, sheet), W - 1.6, 0.46, 1.65); add(boxMesh(1.6, 0.14, 0.45, pillow), W - 1.6, 0.62, 0.75); add(boxMesh(2.0, 1.0, 0.08, wood), W - 1.6, 0.6, 0.45); solid(W - 1.6, 1.6, 2.0, 2.3);
      model('boombox', W - 0.7, 0, 4.2, -Math.PI / 2, 1); model('potted_plant_02', 0.6, 0, D - 0.8, 0, 1.2);
      acts.push({ x: W - 1.6, z: 3.4, r: 1.8, label: 'Bed', kind: 'bed' }, { x: 2.6, z: 2.2, r: 1.8, label: 'TV', kind: 'tv' }, { x: W - 0.9, z: 5.2, r: 1.5, label: 'Phone', kind: 'phone' });
    }
    acts.push({ x: W / 2, z: D - 1.1, r: 1.6, label: 'Exit', kind: 'exit' });
    if (r.clerk) { const v = Gfx.billboard(g, r.clerk.char, r.clerk.hue); v.grp.position.set(r.clerk.x + ox, 0, r.clerk.z + oz); npcs.push({ v, name: r.clerk.name, x: r.clerk.x, z: r.clerk.z, clerk: true }); }
    const o = { key, r, g, cols, acts, npcs, lights, bounds: [0.45, 0.45, W - 0.45, D - 0.4] };
    cache[key] = o; return o;
  }
  function enter(key) { const o = build(key); cur = o; Gfx.setInterior(o.g); Gfx.interiorLights(o.lights); return { x: M(o.r.w / 2, IX), y: M(o.r.d - 3.4, IY), yaw: -Math.PI / 2 }; }
  function leave() { cur = null; Gfx.interiorLights(null); Gfx.setInterior(null); }
  const M = (m, off) => Math.round(m / K) + off;
  function push(x, y, rad) {
    if (!cur) return { x, y, hit: false };
    let hit = false; const b = cur.bounds;
    x = Math.max(M(b[0], IX), Math.min(M(b[2], IX), x)); y = Math.max(M(b[1], IY), Math.min(M(b[3], IY), y));
    for (const c of cur.cols) {
      const x0 = M(c[0], IX), y0 = M(c[1], IY), x1 = M(c[2], IX), y1 = M(c[3], IY), cx = Math.max(x0, Math.min(x1, x)), cy = Math.max(y0, Math.min(y1, y)), dx = x - cx, dy = y - cy, d = Math.hypot(dx, dy);
      if (d < rad) { hit = true; if (d < 0.001) { y = y1 + rad; } else { x = cx + dx / d * rad; y = cy + dy / d * rad; } }
    }
    return { x, y, hit };
  }
  function bounds() { return cur ? { x0: M(cur.bounds[0], IX), y0: M(cur.bounds[1], IY), x1: M(cur.bounds[2], IX), y1: M(cur.bounds[3], IY) } : null; }
  function nearest(x, y) {
    if (!cur) return null; let best = null, bd = 1e9;
    for (const a of cur.acts) { const ax = M(a.x, IX), ay = M(a.z, IY), d = Math.hypot(ax - x, ay - y); if (d < a.r / K && d < bd) { bd = d; best = a; } }
    for (const n of cur.npcs) { const ax = M(n.x, IX), ay = M(n.z, IY), d = Math.hypot(ax - x, ay - y); if (d < 2.6 / K && d < bd - 30) { bd = d; best = { kind: 'npc', npc: n, label: 'Talk to ' + n.name }; } }
    return best;
  }
  function animate(t, yaw, tint) { if (!cur) return; const th = Math.atan2(-Math.cos(yaw), -Math.sin(yaw)); for (const n of cur.npcs) n.v.face(th, 1, Math.floor(t * 1.4 + n.x) % 2, tint); }
  return { ROOMS, enter, leave, push, bounds, nearest, animate, get current() { return cur; }, IX, IY };
})();
