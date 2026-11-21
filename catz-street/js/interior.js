// Shop and safehouse interiors. Rooms live far outside the city; coordinates are sim px like everywhere else.
const Interior = (() => {
  const K = Gfx.K, IX = -14000, IY = -14000;
  const cache = {};
  let cur = null;
  const M = (v, o) => Math.round(v / K) + o;           // metres -> sim px (local to IX / IY)

  const ROOMS = {
    bodega:  { name: 'BODEGA', w: 15, d: 11, wall: '#2f6b52', trim: '#e9d8a6', floor: ['#d9d3c2', '#aaa48f'], neon: ['BODEGA', '#3ef2a0'], clerk: { char: 'pimp_daddy', hue: 80, x: 7.5, z: 2.0, name: 'MR. WHISKERS' }, shop: 'bodega', counter: [7.5, 2.9, 7, 1.2], tag: 'Wings, sodas, kevlar. Cash only.' },
    pawn:    { name: 'PAWN SHOP', w: 15, d: 11, wall: '#4a3b2a', trim: '#ffd23f', floor: ['#6b5a46', '#54463a'], neon: ['PAWN', '#ffd23f'], clerk: { char: 'crimson_paw', hue: 200, x: 7.5, z: 2.0, name: 'BIG TONE' }, shop: 'pawn', counter: [7.5, 2.9, 7, 1.2], tag: 'No questions. Strictly business.' },
    fits:    { name: 'FRESH FITS', w: 16, d: 11, wall: '#6b2a63', trim: '#ff9ad5', floor: ['#2b2438', '#201a2c'], neon: ['FRESH FITS', '#ff4fd8'], clerk: { char: 'prison', hue: 280, x: 12.5, z: 2.4, name: 'LADY LYNX' }, shop: 'fits', counter: [12.5, 3.2, 4, 1.2], tag: 'Dress like you mean it.' },
    records: { name: 'RECORD SPOT', w: 14, d: 10, wall: '#3a2a6b', trim: '#c78bff', floor: ['#1d1830', '#2a2248'], neon: ['RECORDS', '#c78bff'], clerk: { char: 'crimson_paw', hue: 270, x: 10.5, z: 2.2, name: 'DJ PURRSON' }, shop: 'records', counter: [10.5, 3.1, 4.5, 1.2], tag: 'Crate-digging since 1989.' },
    home:    { name: 'SAFEHOUSE', w: 12, d: 9, wall: '#2a4a6b', trim: '#4fc3ff', floor: ['#7a5a3a', '#6a4c30'], neon: ['HOME', '#4fc3ff'], clerk: null, shop: 'home', tag: 'Your spot. Nobody knows about it.' },
  };

  function wallTex(r) {
    return Gfx.tex(256, 128, (x, w, h) => {
      x.fillStyle = r.wall; x.fillRect(0, 0, w, h); x.fillStyle = 'rgba(0,0,0,.18)'; x.fillRect(0, h * 0.62, w, h * 0.38); x.fillStyle = r.trim; x.fillRect(0, h * 0.6, w, 4);
      for (let i = 0; i < 6; i++) { x.fillStyle = 'rgba(255,255,255,.05)'; x.fillRect(i * 44 + 6, 6, 3, h - 12); }
      x.fillStyle = 'rgba(0,0,0,.25)'; x.fillRect(0, 0, w, 10);
    }, { repeat: true });
  }
  function floorTex(r) {
    const t = Gfx.tex(128, 128, (x) => { x.fillStyle = r.floor[0]; x.fillRect(0, 0, 128, 128); x.fillStyle = r.floor[1]; x.fillRect(0, 0, 64, 64); x.fillRect(64, 64, 64, 64); }, { repeat: true });
    return t;
  }
  const signTex = (txt, c) => Gfx.tex(512, 128, (x, w, h) => {
    x.fillStyle = '#0b0a14'; x.fillRect(0, 0, w, h); x.strokeStyle = c; x.lineWidth = 8; x.strokeRect(6, 6, w - 12, h - 12);
    let fs = 70; x.font = `900 ${fs}px "Arial Black", Impact, sans-serif`; while (x.measureText(txt).width > w - 60 && fs > 20) { fs -= 4; x.font = `900 ${fs}px "Arial Black", Impact, sans-serif`; }
    x.textAlign = 'center'; x.textBaseline = 'middle'; x.shadowColor = c; x.shadowBlur = 18; x.fillStyle = c; x.fillText(txt, w / 2, h / 2 + 4);
  });
  const lam = c => new THREE.MeshLambertMaterial({ color: c });
  const emi = (c, o) => new THREE.MeshBasicMaterial({ color: c, transparent: o !== undefined, opacity: o === undefined ? 1 : o });

  function build(key) {
    if (cache[key]) return cache[key];
    const r = ROOMS[key], g = new THREE.Group(), cols = [], acts = [], npcs = [];
    const W = r.w, D = r.d, H = 3.8;
    const add = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x + IX * K, y, z + IY * K); g.add(m); return m; };
    // floor, ceiling, walls
    const ft = floorTex(r); ft.repeat.set(W / 3, D / 3); add(new THREE.PlaneGeometry(W, D).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ map: ft }), W / 2, 0, D / 2);
    add(new THREE.PlaneGeometry(W, D).rotateX(Math.PI / 2), lam(0x1c1426), W / 2, H, D / 2);
    const wt = wallTex(r), wm = new THREE.MeshLambertMaterial({ map: wt });
    const wall = (w, x, z, ry) => { wt.repeat.set(w / 5, 1); const m = add(new THREE.PlaneGeometry(w, H), new THREE.MeshLambertMaterial({ map: wt.clone() }), x, H / 2, z); m.material.map.needsUpdate = true; m.material.map.repeat.set(w / 5, 1); m.rotation.y = ry; return m; };
    wall(W, W / 2, 0, 0); wall(W, W / 2, D, Math.PI); wall(D, 0, D / 2, Math.PI / 2); wall(D, W, D / 2, -Math.PI / 2);
    // ceiling light strips + neon sign on the back wall
    for (let i = 1; i < 4; i++) add(new THREE.BoxGeometry(W * 0.22, 0.06, 0.2), emi(0xfff2d0), W * i / 4 + (i === 2 ? 0 : 0), H - 0.05, D * (i % 2 ? 0.35 : 0.65));
    const sg = add(new THREE.PlaneGeometry(4.4, 1.1), new THREE.MeshBasicMaterial({ map: signTex(r.neon[0], r.neon[1]) }), W / 2, 2.95, 0.04);
    const glow = add(new THREE.PlaneGeometry(9, 4).rotateX(0), new THREE.MeshBasicMaterial({ map: Gfx.radial([[0, r.neon[1] + '66'], [1, r.neon[1] + '00']]), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }), W / 2, 2.8, 0.06);
    // exit door
    add(new THREE.BoxGeometry(2.2, 0.04, 1.4), lam(0x331a10), W / 2, 0.03, D - 0.8);
    const dm = add(new THREE.PlaneGeometry(2.4, 3), new THREE.MeshLambertMaterial({ color: 0x2b1a10 }), W / 2, 1.5, D - 0.02); dm.rotation.y = Math.PI;
    add(new THREE.PlaneGeometry(1.7, 1.2), emi(0xffd98a), W / 2, 2.1, D - 0.04).rotation.y = Math.PI;
    const solid = (x, z, w, d, h, color, y0) => { const m = add(new THREE.BoxGeometry(w, h, d), lam(color), x, (y0 || 0) + h / 2, z); cols.push([x - w / 2, z - d / 2, x + w / 2, z + d / 2]); return m; };
    const deco = (x, z, w, d, h, color, y0) => add(new THREE.BoxGeometry(w, h, d), lam(color), x, (y0 || 0) + h / 2, z);
    const rnd = (a, b) => a + Math.random() * (b - a);
    const shelfRow = (x, z, w, d, colors, horiz) => { solid(x, z, w, d, 2.2, 0x3b2f27); for (let lvl = 0; lvl < 3; lvl++) { const n = Math.floor((horiz ? w : d) / 0.5); for (let i = 0; i < n; i++) { const off = -((horiz ? w : d) / 2) + 0.3 + i * 0.5; deco(horiz ? x + off : x, horiz ? z : z + off, horiz ? 0.34 : d * 0.85, horiz ? d * 0.85 : 0.34, 0.34, colors[(i + lvl * 3) % colors.length], 0.5 + lvl * 0.55); } } };
    const PC = [0xe11d48, 0xfacc15, 0x38bdf8, 0x22c55e, 0xf97316, 0xa855f7];
    if (key === 'bodega') {
      solid(...r.counter.slice(0, 2), r.counter[2], r.counter[3], 1.1, 0x7a4b2a); deco(r.counter[0], r.counter[1], r.counter[2] + 0.1, r.counter[3] + 0.1, 0.1, 0xd6c7a1, 1.1);
      shelfRow(2.2, 6, 0.9, 5.5, PC, false); shelfRow(W - 2.2, 6, 0.9, 5.5, PC, false); shelfRow(W / 2, 5.4, 4.6, 0.9, PC, true);
      solid(W - 1.1, 1.4, 1.4, 1.2, 2.2, 0x6aa7d9); add(new THREE.PlaneGeometry(1.2, 1.9), emi(0xbfe6ff), W - 1.1, 1.2, 2.02);
      acts.push({ x: r.counter[0], z: r.counter[1] + 1.4, r: 2.6, label: 'Talk to the clerk', kind: 'shop' });
    } else if (key === 'pawn') {
      solid(r.counter[0], r.counter[1], r.counter[2], r.counter[3], 1.1, 0x2a2a30); deco(r.counter[0], r.counter[1], r.counter[2] + 0.1, r.counter[3] + 0.1, 0.08, 0x9fd2e8, 1.1);
      for (let i = 0; i < 5; i++) { deco(2.5 + i * 2.2, 0.15, 1.2, 0.06, 0.18, 0x111111, 2.1 + (i % 2) * 0.3); deco(2.9 + i * 2.2, 0.15, 0.25, 0.06, 0.45, 0x111111, 1.7 + (i % 2) * 0.3); }
      shelfRow(2.2, 7, 0.9, 5, [0xb08d57, 0x3b3b44, 0x8a8a95, 0x6b3a2a], false); shelfRow(W - 2.2, 7, 0.9, 5, [0xb08d57, 0x3b3b44, 0x8a8a95, 0x6b3a2a], false);
      solid(W / 2, 7, 2.4, 1.2, 1, 0x4a3b2a);
      acts.push({ x: r.counter[0], z: r.counter[1] + 1.4, r: 2.6, label: 'Talk to Big Tone', kind: 'shop' });
    } else if (key === 'fits') {
      solid(r.counter[0], r.counter[1], r.counter[2], r.counter[3], 1.1, 0x3a2040);
      for (let i = 0; i < 3; i++) { solid(3 + i * 3.2, 6.4, 2.4, 0.5, 1.6, 0x888888, 0); for (let j = 0; j < 7; j++) deco(2 + i * 3.2 + j * 0.35, 6.4, 0.25, 0.7, 1.3, [0xff4fd8, 0xffd23f, 0x3ec8ff, 0x7c3aed, 0x22c55e][(i + j) % 5], 0.3); }
      add(new THREE.PlaneGeometry(2.4, 3.2), new THREE.MeshBasicMaterial({ color: 0xcfe8ff }), 0.03, 1.8, 6.5).rotation.y = Math.PI / 2; solid(0.3, 6.5, 0.4, 2.5, 0.2, 0x555555);
      acts.push({ x: r.counter[0] - 0.5, z: r.counter[1] + 1.4, r: 2.8, label: 'Browse the racks', kind: 'shop' });
    } else if (key === 'records') {
      solid(r.counter[0], r.counter[1], r.counter[2], r.counter[3], 1.1, 0x2a2048); deco(r.counter[0] - 1, r.counter[1], 1.3, 0.9, 0.12, 0x111, 1.1); add(new THREE.CylinderGeometry(0.4, 0.4, 0.05, 20), emi(0x111111), r.counter[0] - 1 + IX * 0 , 1.27, r.counter[1]);
      for (let i = 0; i < 4; i++) { solid(2.4 + i * 2.4, 6.5, 1.9, 1, 0.9, 0x6b4a2a); for (let j = 0; j < 9; j++) deco(1.7 + i * 2.4 + j * 0.16, 6.5, 0.1, 0.8, 0.5, PC[(i + j) % PC.length], 0.9); }
      solid(1, 2.2, 1, 1, 1.6, 0x111111); solid(W - 1, 4, 1, 1, 1.6, 0x111111);
      acts.push({ x: r.counter[0], z: r.counter[1] + 1.4, r: 2.6, label: 'Talk to DJ Purrson', kind: 'shop' });
    } else if (key === 'home') {
      solid(2.4, 6.6, 3.2, 1.5, 0.9, 0x6b2a63); deco(2.4, 7.2, 3.2, 0.4, 1.5, 0x5a2252, 0);       // couch
      solid(W - 2, 1.2, 3, 2, 0.6, 0xc9c1d9); deco(W - 2, 0.6, 3, 0.3, 1.2, 0x7a4b2a, 0);         // bed
      solid(2.4, 2.2, 3, 0.5, 0.7, 0x222222); add(new THREE.PlaneGeometry(2.6, 1.5), new THREE.MeshBasicMaterial({ color: 0x77bbff }), 2.4, 1.6, 0.08);   // tv
      solid(W - 1, 5.4, 0.8, 0.8, 0.8, 0x7a4b2a);
      acts.push({ x: W - 2, z: 2.9, r: 2.2, label: 'Bed', kind: 'bed' }, { x: 2.4, z: 3.4, r: 2.2, label: 'TV', kind: 'tv' }, { x: W - 1, z: 4.3, r: 1.8, label: 'Phone', kind: 'phone' });
    }
    acts.push({ x: W / 2, z: D - 1.3, r: 1.7, label: 'Exit', kind: 'exit' });
    // npcs
    if (r.clerk) { const v = Gfx.billboard(g, r.clerk.char, r.clerk.hue); v.grp.position.set(r.clerk.x + IX * K, 0, r.clerk.z + IY * K); npcs.push({ v, name: r.clerk.name, x: r.clerk.x, z: r.clerk.z, clerk: true }); }
    const o = { key, r, g, cols, acts, npcs, bounds: [0.6, 0.6, W - 0.6, D - 0.5] };
    cache[key] = o; return o;
  }

  function enter(key) {
    const o = build(key); cur = o; Gfx.setInterior(o.g);
    return { x: M(o.r.w / 2, IX), y: M(o.r.d - 2.4, IY), yaw: -Math.PI / 2 };
  }
  function leave() { cur = null; Gfx.setInterior(null); }
  const px = (m, off) => Math.round(m / K) + off;
  // push a circle (sim px) out of the room's furniture and walls
  function push(x, y, rad) {
    if (!cur) return { x, y, hit: false };
    let hit = false; const b = cur.bounds;
    x = Math.max(px(b[0], IX), Math.min(px(b[2], IX), x)); y = Math.max(px(b[1], IY), Math.min(px(b[3], IY), y));
    for (const c of cur.cols) {
      const x0 = px(c[0], IX), y0 = px(c[1], IY), x1 = px(c[2], IX), y1 = px(c[3], IY), cx = Math.max(x0, Math.min(x1, x)), cy = Math.max(y0, Math.min(y1, y)), dx = x - cx, dy = y - cy, d = Math.hypot(dx, dy);
      if (d < rad) { hit = true; if (d < 0.001) { x = x0 - rad; } else { x = cx + dx / d * rad; y = cy + dy / d * rad; } }
    }
    return { x, y, hit };
  }
  function bounds() { return cur ? { x0: px(cur.bounds[0], IX), y0: px(cur.bounds[1], IY), x1: px(cur.bounds[2], IX), y1: px(cur.bounds[3], IY) } : null; }
  function nearest(x, y) {
    if (!cur) return null; let best = null, bd = 1e9;
    for (const a of cur.acts) { const ax = px(a.x, IX), ay = px(a.z, IY), d = Math.hypot(ax - x, ay - y); if (d < a.r / K && d < bd) { bd = d; best = a; } }
    for (const n of cur.npcs) { const ax = px(n.x, IX), ay = px(n.z, IY), d = Math.hypot(ax - x, ay - y); if (d < 2.4 / K && d < bd - 40) { bd = d; best = { kind: 'npc', npc: n, label: 'Talk to ' + n.name }; } }
    return best;
  }
  function animate(t, yaw, tint) {
    if (!cur) return; const rx = -Math.sin(yaw), rz = Math.cos(yaw), th = Math.atan2(-Math.cos(yaw), -Math.sin(yaw));
    for (const n of cur.npcs) { n.v.face(th, 1, Math.floor(t * 1.4 + n.x) % 2, tint); }
  }
  return { ROOMS, enter, leave, push, bounds, nearest, animate, get current() { return cur; }, IX, IY };
})();
