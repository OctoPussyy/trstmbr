// Cars, pedestrians, cops, pickups and particles: simulation, AI and drawing.
const Ents = (() => {
  const { R, P, N, SIZE, LO, DX, DY } = World;
  const cars = [], peds = [], pickups = [], fx = [], skids = [];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const angDiff = (a, b) => { let d = a - b; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; };
  const COLORS = ['#7b2cbf', '#14b8a6', '#e6b422', '#ec4899', '#dc2626', '#e5e7eb', '#2563eb', '#f97316', '#1f2937', '#84cc16', '#0ea5e9'];
  const TYPES = {
    sedan:    { len: 100, wid: 46, max: 340, acc: 270, hp: 900,  mass: 1 },
    lowrider: { len: 118, wid: 50, max: 310, acc: 250, hp: 1000, mass: 1.2 },
    van:      { len: 110, wid: 54, max: 275, acc: 200, hp: 1100, mass: 1.5 },
    sport:    { len: 96,  wid: 44, max: 490, acc: 360, hp: 700,  mass: 0.9 },
    taxi:     { len: 100, wid: 46, max: 340, acc: 270, hp: 900,  mass: 1 },
    police:   { len: 104, wid: 47, max: 440, acc: 340, hp: 1100, mass: 1.2 },
  };
  const CHARS = ['prison', 'crimson_paw', 'pimp_daddy'];
  const HUES = [0, 40, 80, 120, 160, 200, 240, 280, 320];
  const sound = (n, a) => Snd.play(n, a);

  // ================= cars =================
  function makeCar(type, x, y, a, o) {
    o = o || {}; const T = TYPES[type];
    const c = { type, x, y, a, vx: 0, vy: 0, av: 0, len: T.len, wid: T.wid, max: T.max * (o.maxMul || 1), acc: T.acc, hp: T.hp, maxhp: T.hp, mass: T.mass,
      color: o.color || (type === 'police' ? '#111827' : type === 'taxi' ? '#f5c518' : pick(COLORS)), driver: o.driver === undefined ? null : o.driver,
      thr: 0, steer: 0, brake: 0, hand: 0, route: [], node: null, dir: 0, mode: o.mode || 'traffic', stuck: 0, ghost: 0, age: 0, burn: 0, wreck: false, keep: !!o.keep,
      speedF: 0, slip: 0, cruise: rnd(120, 185), repath: 0, rev: 0, rival: !!o.rival, hornT: 0, hitCd: 0 };
    cars.push(c); return c;
  }
  function stepCar(c, dt) {
    if (c.wreck) { const k = Math.exp(-2.5 * dt); c.vx *= k; c.vy *= k; c.x += c.vx * dt; c.y += c.vy * dt; c.av *= k; c.a += c.av * dt; c.speedF = 0; return; }
    const fx_ = Math.cos(c.a), fy_ = Math.sin(c.a);
    let vf = c.vx * fx_ + c.vy * fy_, vs = -c.vx * fy_ + c.vy * fx_;
    const maxR = c.max * 0.33;
    if (c.thr > 0 && vf < c.max) vf += c.acc * c.thr * dt * (1 - Math.max(0, vf) / c.max * 0.55);
    if (c.brake > 0) { if (vf > 6) vf -= c.acc * 2.4 * c.brake * dt; else if (vf > -maxR) vf -= c.acc * 0.6 * c.brake * dt; }
    vf -= vf * 0.32 * dt; vf -= Math.sign(vf) * Math.min(Math.abs(vf), 26 * dt);
    if (c.hand) vf *= Math.exp(-0.55 * dt);
    const grip = c.hand ? 1.0 : (Math.abs(vs) > 150 ? 3.6 : 8.5);
    vs *= Math.exp(-grip * dt);
    const sp = Math.abs(vf), delta = c.steer * 0.62 / (1 + sp / 330);
    let av = (vf / 62) * Math.tan(delta) * (c.hand ? 1.55 : 1);
    if (sp < 10) av = 0;
    c.av += (av - c.av) * Math.min(1, dt * 10);
    c.a += c.av * dt;
    const f2x = Math.cos(c.a), f2y = Math.sin(c.a);
    c.vx = f2x * vf - f2y * vs; c.vy = f2y * vf + f2x * vs;
    c.x += c.vx * dt; c.y += c.vy * dt;
    c.speedF = vf; c.slip = Math.abs(vs);
  }
  function carCollideWorld(c) {
    const f = { x: Math.cos(c.a), y: Math.sin(c.a) }, s = { x: -f.y, y: f.x };
    const hl = c.len / 2 - 3, hw = c.wid / 2 - 2;
    let maxI = 0;
    for (const [lx, ly] of [[hl, hw], [hl, -hw], [-hl, hw], [-hl, -hw], [hl, 0], [-hl, 0], [0, hw], [0, -hw]]) {
      const px = c.x + f.x * lx + s.x * ly, py = c.y + f.y * lx + s.y * ly, b = World.buildingAt(px, py);
      if (!b) continue;
      const dl = px - b.x, dr = b.x + b.w - px, dt = py - b.y, db = b.y + b.h - py, m = Math.min(dl, dr, dt, db);
      let nx = 0, ny = 0;
      if (m === dl) { nx = -1; c.x -= dl + 0.5; } else if (m === dr) { nx = 1; c.x += dr + 0.5; } else if (m === dt) { ny = -1; c.y -= dt + 0.5; } else { ny = 1; c.y += db + 0.5; }
      const vn = c.vx * nx + c.vy * ny;
      if (vn < 0) { c.vx -= 1.25 * vn * nx; c.vy -= 1.25 * vn * ny; maxI = Math.max(maxI, -vn); c.av *= 0.6; }
    }
    if (c.x < 20 || c.x > SIZE - 20 || c.y < 20 || c.y > SIZE - 20) {
      const vx = c.vx, vy = c.vy; c.x = clamp(c.x, 20, SIZE - 20); c.y = clamp(c.y, 20, SIZE - 20);
      if ((c.x <= 20 && vx < 0) || (c.x >= SIZE - 20 && vx > 0)) { c.vx *= -0.3; maxI = Math.max(maxI, Math.abs(vx)); }
      if ((c.y <= 20 && vy < 0) || (c.y >= SIZE - 20 && vy > 0)) { c.vy *= -0.3; maxI = Math.max(maxI, Math.abs(vy)); }
    }
    if (maxI > 80) {
      damageCar(c, (maxI - 60) * 0.7, c.driver === 'player' ? 'player' : null);
      if (c.hitCd <= 0) { sound('crash', maxI / 300); c.hitCd = 0.25; if (c.driver === 'player') G.shake(Math.min(14, maxI / 30)); sparks(c.x + f.x * hl, c.y + f.y * hl, 6); }
    }
  }
  const circles = c => { const r = c.wid / 2 + 2, o = c.len / 2 - r, fx_ = Math.cos(c.a), fy_ = Math.sin(c.a); return [{ x: c.x + fx_ * o, y: c.y + fy_ * o, r }, { x: c.x - fx_ * o, y: c.y - fy_ * o, r }]; };
  function carPair(a, b) {
    if (Math.abs(a.x - b.x) > 140 || Math.abs(a.y - b.y) > 140) return;
    const ca = circles(a), cb = circles(b);
    for (const pa of ca) for (const pb of cb) {
      let dx = pb.x - pa.x, dy = pb.y - pa.y, d = Math.hypot(dx, dy), rr = pa.r + pb.r;
      if (d >= rr) continue;
      if (d < 0.01) { dx = 1; dy = 0; d = 1; }
      const nx = dx / d, ny = dy / d, pen = rr - d, ma = a.mass, mb = b.mass, tm = ma + mb;
      a.x -= nx * pen * mb / tm; a.y -= ny * pen * mb / tm; b.x += nx * pen * ma / tm; b.y += ny * pen * ma / tm;
      const rel = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
      if (rel < 0) {
        const j = -(1.35) * rel / (1 / ma + 1 / mb);
        a.vx -= j * nx / ma; a.vy -= j * ny / ma; b.vx += j * nx / mb; b.vy += j * ny / mb;
        a.av += (Math.random() - 0.5) * 0.8 * (-rel) / 300; b.av += (Math.random() - 0.5) * 0.8 * (-rel) / 300;
        const imp = -rel;
        if (imp > 65) {
          const pl = a.driver === 'player' || b.driver === 'player';
          damageCar(a, imp * 0.5, b.driver === 'player' ? 'player' : null); damageCar(b, imp * 0.5, a.driver === 'player' ? 'player' : null);
          if (a.hitCd <= 0 && b.hitCd <= 0) { sound('crash', imp / 400); a.hitCd = b.hitCd = 0.25; sparks((pa.x + pb.x) / 2, (pa.y + pb.y) / 2, 5); if (pl) G.shake(Math.min(14, imp / 30)); }
          if (pl) { const other = a.driver === 'player' ? b : a; if (other.driver === 'cop') G.crime(0.25, other.x, other.y); else if (imp > 160) G.crime(0.6, other.x, other.y); if (other.driver === 'npc' && Math.random() < 0.5) other.hornT = 1.2; }
        }
      }
    }
  }
  function damageCar(c, d, by) {
    if (c.wreck || c.burn > 0) return;
    c.hp -= d;
    if (c.hp <= 0) { c.hp = 0; c.burn = 2.6; c.burnBy = by; }
  }
  function explodeCar(c) {
    c.wreck = true; c.burn = 0; c.color = '#1a1a1a';
    sound('boom'); G.shake(16);
    for (let i = 0; i < 28; i++) fx.push({ t: 'fire', x: c.x + rnd(-24, 24), y: c.y + rnd(-14, 14), vx: rnd(-90, 90), vy: rnd(-130, 10), r: rnd(14, 34), life: rnd(0.5, 1.2), max: 1.2 });
    fx.push({ t: 'ring', x: c.x, y: c.y, r: 10, life: 0.5, max: 0.5 });
    for (const p of peds) if (!p.dead && Math.hypot(p.x - c.x, p.y - c.y) < 130) hurtPed(p, 70, p.x - c.x, p.y - c.y, c.burnBy);
    for (const o of cars) if (o !== c && Math.hypot(o.x - c.x, o.y - c.y) < 120) { damageCar(o, 220, c.burnBy); o.vx += (o.x - c.x) * 1.8; o.vy += (o.y - c.y) * 1.8; }
    G.onCarExplode(c);
    c.driver = null;
    c.wreckT = 40;
  }
  function sparks(x, y, n) { for (let i = 0; i < n; i++) fx.push({ t: 'spark', x, y, vx: rnd(-160, 160), vy: rnd(-160, 160), life: rnd(0.15, 0.4), max: 0.4 }); }

  // ---- car AI ----
  function planNext(c) {
    const [ni, nj] = c.node, d = c.dir, opts = [];
    for (const [d2, w] of [[d, 6], [(d + 1) % 4, 2], [(d + 3) % 4, 2]]) {
      const a = ni + DX[d2], b = nj + DY[d2];
      if (a >= 0 && a <= N && b >= 0 && b <= N) opts.push([d2, w]);
    }
    let tot = opts.reduce((s, o) => s + o[1], 0), r = Math.random() * tot, d2 = opts[0][0];
    for (const o of opts) { if ((r -= o[1]) <= 0) { d2 = o[0]; break; } }
    const E = World.lanePoint(c.node, d, -(R / 2 + 34)), X = World.lanePoint(c.node, d2, R / 2 + 34);
    E.r = 46; X.r = 50;
    c.route.push(E);
    if (d2 !== d) c.route.push(d % 2 === 0 ? { x: X.x, y: E.y, r: 55 } : { x: E.x, y: X.y, r: 55 });
    c.route.push(X);
    c.node = [ni + DX[d2], nj + DY[d2]]; c.dir = d2;
  }
  function obstacleAhead(c) {
    const f = { x: Math.cos(c.a), y: Math.sin(c.a) }, s = { x: -f.y, y: f.x };
    const look = 50 + Math.max(0, c.speedF) * 0.55; let best = null;
    const test = (x, y, lat, spd) => {
      const dx = x - c.x, dy = y - c.y, lx = dx * f.x + dy * f.y, ly = dx * s.x + dy * s.y;
      if (lx > c.len / 2 - 4 && lx < look + c.len / 2 && Math.abs(ly) < c.wid / 2 + lat) { const d = lx - c.len / 2; if (!best || d < best.d) best = { d, spd }; }
    };
    for (const o of cars) { if (o === c || Math.abs(o.x - c.x) > 300 || Math.abs(o.y - c.y) > 300) continue; test(o.x, o.y, 8, Math.max(0, o.speedF)); }
    if (G.player && !G.player.car) test(G.player.x, G.player.y, 12, 0);
    for (const p of peds) { if (p.dead || Math.abs(p.x - c.x) > 300 || Math.abs(p.y - c.y) > 300) continue; test(p.x, p.y, 12, 0); }
    return best;
  }
  function steerTo(c, tgt, cruise, careful, dt) {
    const dx = tgt.x - c.x, dy = tgt.y - c.y, da = angDiff(Math.atan2(dy, dx), c.a);
    let sp = cruise * (1 - Math.min(0.65, Math.abs(da) * 0.75));
    if (c.rev > 0) { c.rev -= dt; c.thr = 0; c.brake = 1; c.steer = -Math.sign(da || 1); return; }
    if (c.ghost <= 0) {
      const ob = obstacleAhead(c);
      if (ob) { const k = clamp((ob.d - 14) / 70, 0, 1); sp = Math.min(sp, ob.spd * 0.9 * k + (careful ? 0 : 60 * k)); if (ob.d < 30 && !careful) sp = 0; }
    } else c.ghost -= dt;
    c.steer = clamp(da * 2.3, -1, 1);
    const vf = c.speedF;
    c.thr = vf < sp ? 1 : 0; c.brake = vf > sp + 22 ? clamp((vf - sp) / 180, 0, 1) : 0;
    if (Math.abs(vf) < 14 && sp > 40) { c.stuck += dt; if (c.stuck > 2.2) { c.ghost = 2.5; c.stuck = 0; if (c.mode !== 'traffic' || Math.random() < 0.4) c.rev = 0.9; } } else c.stuck = Math.max(0, c.stuck - dt);
  }
  function aiTraffic(c, dt) {
    if (!c.route.length) planNext(c);
    const t = c.route[0];
    if (Math.hypot(t.x - c.x, t.y - c.y) < (t.r || 48)) { c.route.shift(); if (!c.route.length) planNext(c); return; }
    steerTo(c, t, c.cruise, true, dt);
    if (c.hornT > 0) { c.hornT -= dt; }
  }
  function aiChase(c, dt, tgt) {
    c.repath -= dt;
    const dist = Math.hypot(tgt.x - c.x, tgt.y - c.y);
    if (c.repath <= 0) {
      c.repath = 0.8; c.route.length = 0;
      if (dist < 440 && World.los(c.x, c.y, tgt.x, tgt.y)) c.route.push({ x: tgt.x + (tgt.vx || 0) * 0.35, y: tgt.y + (tgt.vy || 0) * 0.35, r: 30 });
      else {
        const n0 = World.nearestNode(c.x, c.y), n1 = World.nearestNode(tgt.x, tgt.y), pts = [];
        let [i, j] = n0; const hx = Math.cos(c.a), hy = Math.sin(c.a);
        const first = (World.center(i) - c.x) * hx + (World.center(j) - c.y) * hy;
        if (first > 0 || Math.hypot(World.center(i) - c.x, World.center(j) - c.y) > 130) pts.push({ x: World.center(i), y: World.center(j), r: 70 });
        const horizFirst = Math.abs(n1[0] - i) >= Math.abs(n1[1] - j);
        const walk = (axis) => { if (axis === 0) while (i !== n1[0]) { i += Math.sign(n1[0] - i); pts.push({ x: World.center(i), y: World.center(j), r: 70 }); } else while (j !== n1[1]) { j += Math.sign(n1[1] - j); pts.push({ x: World.center(i), y: World.center(j), r: 70 }); } };
        if (horizFirst) { walk(0); walk(1); } else { walk(1); walk(0); }
        pts.push({ x: tgt.x, y: tgt.y, r: 40 });
        c.route = pts;
      }
    }
    while (c.route.length > 1 && Math.hypot(c.route[0].x - c.x, c.route[0].y - c.y) < (c.route[0].r || 60)) c.route.shift();
    const t = c.route[0] || tgt;
    steerTo(c, t, c.max * (c.rival ? 0.78 : 0.9), false, dt);
  }

  // ================= peds =================
  function makePed(kind, x, y, o) {
    o = o || {};
    const p = { kind, x, y, vx: 0, vy: 0, hx: 1, hy: 0, shootCd: 0, gunUp: false, talk: false, char: o.char || pick(CHARS), hue: o.hue !== undefined ? o.hue : pick(HUES), hp: o.hp || 40, maxhp: o.hp || 40, face: Math.random() < 0.5 ? 1 : -1,
      state: 'idle', t: rnd(0.2, 2.5), walkPh: rnd(0, 6), tx: x, ty: y, spd: rnd(34, 56), atk: null, down: 0, downT: 0, dead: false, deadT: 0, flee: 0, scale: o.scale || 0.04,
      seed: Math.random() * 100, hostile: !!o.hostile, keep: !!o.keep, label: o.label || null, stuck: 0, atkCd: 0, thx: 0, thy: 0, flash: 0, still: !!o.still };
    if (kind === 'cop') { p.char = 'pimp_daddy'; p.hue = -85; p.hp = 70; p.maxhp = 70; p.state = 'cop'; p.hostile = true; }
    if (kind === 'rival') { p.char = 'crimson_paw'; p.hue = 0; p.hp = o.hp || 55; p.maxhp = p.hp; p.hostile = true; p.state = 'fight'; }
    if (kind === 'target') { p.char = o.char || 'prison'; p.hue = o.hue !== undefined ? o.hue : 150; p.hp = o.hp || 45; p.maxhp = p.hp; }
    peds.push(p); return p;
  }
  function hurtPed(p, dmg, dx, dy, src) {
    if (p.dead) return;
    p.hp -= dmg; p.flash = 0.18;
    const d = Math.hypot(dx, dy) || 1; p.vx += dx / d * Math.min(260, 60 + dmg * 7); p.vy += dy / d * Math.min(260, 60 + dmg * 7);
    if (p.hp <= 0) {
      p.dead = true; p.down = 1e9; p.downT = 0; p.deadT = 0; p.state = 'dead'; p.atk = null;
      const amt = p.kind === 'cop' ? 0 : p.kind === 'target' ? 0 : p.kind === 'rival' ? Math.floor(rnd(25, 70)) : Math.floor(rnd(8, 48));
      if (amt) pickups.push({ x: p.x, y: p.y, amt, t: Math.random() * 6 });
      G.onPedDown(p, src);
    } else {
      if (dmg >= 10 || p.hp < p.maxhp * 0.3) { p.down = 0.9 + Math.random() * 0.5; p.downT = 0; p.atk = null; }
      if (p.kind === 'civ') {
        if (p.hostile || Math.random() < 0.05) { p.state = 'fight'; p.hostile = true; } else { p.state = 'flee'; p.flee = 6; p.thx = G.player.x; p.thy = G.player.y; }
      } else if (p.kind === 'target' && Math.random() < 0.55) { p.state = 'flee'; p.flee = 5; p.thx = G.player.x; p.thy = G.player.y; }
    }
  }
  function witnessPanic(x, y, r) {
    for (const p of peds) {
      if (p.dead || p.kind !== 'civ' || p.state === 'flee' || p.state === 'fight') continue;
      if (Math.hypot(p.x - x, p.y - y) < r && Math.random() < 0.7) { p.state = 'flee'; p.flee = rnd(4, 7); p.thx = x; p.thy = y; }
    }
  }
  function pedAttack(p, target, mv, dmg) {
    p.atk = { m: mv, t: 0, done: false, dmg };
    sound('whoosh');
  }
  function updatePed(p, dt, pl) {
    p.flash = Math.max(0, p.flash - dt);
    if (p.atkCd > 0) p.atkCd -= dt;
    if (p.dead) { p.downT += dt; p.deadT += dt; p.vx *= Math.exp(-6 * dt); p.vy *= Math.exp(-6 * dt); movePed(p, dt, 0, 0); return; }
    if (p.down > 0) { p.down -= dt; p.downT += dt; p.vx *= Math.exp(-5 * dt); p.vy *= Math.exp(-5 * dt); movePed(p, dt, 0, 0); if (p.down <= 0) p.downT = 0; return; }
    if (p.talk) { p.vx = p.vy = 0; const tx = pl.x - p.x, ty = pl.y - p.y, tl = Math.hypot(tx, ty) || 1; p.hx = tx / tl; p.hy = ty / tl; return; }
    if (p.shootCd > 0) p.shootCd -= dt;
    const dpx = pl.x - p.x, dpy = pl.y - p.y, dp = Math.hypot(dpx, dpy);
    let mx = 0, my = 0, sp = 0;
    p.gunUp = false;
    if (p.kind === 'cop' && G.stars >= 3 && !pl.dead && !G.inside && dp < 460 && dp > 80 && World.los(p.x, p.y, pl.x, pl.y)) {
      p.gunUp = true; p.hx = dpx / dp; p.hy = dpy / dp;
      if (!(p.shootCd > 0)) { p.shootCd = 1.4 + Math.random() * 1.2; G.copShot(p); }
    }
    if (p.atk) {
      const mv = Poses.Moves[p.atk.m]; p.atk.t += dt * 60;
      if (!p.atk.done && p.atk.t >= mv.S) { p.atk.done = true; if (dp < 56 && !pl.dead && !pl.hidden) G.hurtPlayer(p.atk.dmg, p.x, p.y, p); }
      if (p.atk.t >= mv.total) p.atk = null;
    } else if (p.state === 'cop' || p.state === 'fight') {
      if (dp > 1500 && !p.keep) p.far = (p.far || 0) + dt; else p.far = 0;
      if (!pl.dead && (pl.car ? dp < 900 : true)) {
        const tx = pl.x, ty = pl.y;
        if (dp > 46) { mx = dpx / dp; my = dpy / dp; sp = p.kind === 'cop' ? 118 : 100; p.face = dpx >= 0 ? 1 : -1; }
        else if (p.atkCd <= 0 && !pl.car) { p.face = dpx >= 0 ? 1 : -1; pedAttack(p, pl, 'LP', p.kind === 'cop' ? 3 : p.kind === 'rival' ? 5 : 3); p.atkCd = 1.3 + Math.random() * 0.9; }
      }
      if (p.kind === 'cop' && dp < 50 && !pl.car) { /* arrest handled in game */ }
    } else if (p.state === 'flee') {
      p.flee -= dt;
      const ax = p.x - p.thx, ay = p.y - p.thy, ad = Math.hypot(ax, ay) || 1;
      mx = ax / ad; my = ay / ad; sp = p.kind === 'target' ? 105 : 125; p.face = mx >= 0 ? 1 : -1;
      if (p.flee <= 0) { p.state = 'idle'; p.t = 1; }
    } else if (p.state === 'walk') {
      const dx = p.tx - p.x, dy = p.ty - p.y, d = Math.hypot(dx, dy);
      if (d < 10) { p.state = 'idle'; p.t = rnd(0.8, 4); } else { mx = dx / d; my = dy / d; sp = p.spd; p.face = dx >= 0 ? 1 : -1; }
    } else { // idle
      p.t -= dt;
      if (p.t <= 0 && !p.still) { const t = World.randomSidewalk(p.x, p.y, 420); p.tx = t.x; p.ty = t.y; p.state = 'walk'; }
    }
    if (p.hostile && p.kind === 'civ' && !p.atk && p.state !== 'fight') p.state = 'fight';
    if (sp > 0 && !p.gunUp) { p.hx = mx; p.hy = my; } else if (p.atk && dp > 0) { p.hx = dpx / dp; p.hy = dpy / dp; }
    if (p.gunUp) sp = 0;
    p.vx += (mx * sp - p.vx) * Math.min(1, dt * 9); p.vy += (my * sp - p.vy) * Math.min(1, dt * 9);
    movePed(p, dt, mx, my);
    if (sp > 0) p.walkPh += Math.hypot(p.vx, p.vy) * dt * 0.085;
  }
  function movePed(p, dt) {
    const nx = p.x + p.vx * dt, ny = p.y + p.vy * dt;
    const r = World.pushCircle(nx, ny, 11);
    if (r.hit && !p.dead && p.down <= 0 && p.state === 'walk') { p.stuck += dt; if (p.stuck > 1) { p.state = 'idle'; p.t = 0.2; p.stuck = 0; } }
    p.x = r.x; p.y = r.y;
  }

  // ================= vehicles hitting people =================
  function carVsPeds(c, pl) {
    const spd = Math.hypot(c.vx, c.vy); if (spd < 25 || c.wreck) return;
    const f = { x: Math.cos(c.a), y: Math.sin(c.a) }, s = { x: -f.y, y: f.x };
    const test = (p, isPlayer) => {
      const dx = p.x - c.x, dy = p.y - c.y; if (Math.abs(dx) > 90 || Math.abs(dy) > 90) return;
      const lx = dx * f.x + dy * f.y, ly = dx * s.x + dy * s.y;
      if (Math.abs(lx) < c.len / 2 + 4 && Math.abs(ly) < c.wid / 2 + 6) {
        if (isPlayer) { if (c.driver !== 'player' && spd > 100) G.hurtPlayer(spd * 0.1, c.x, c.y, c); return; }
        if (spd < 90) { p.x += s.x * Math.sign(ly || 1) * 3; p.y += s.y * Math.sign(ly || 1) * 3; return; }
        if (p.hitByCar > 0) return;
        p.hitByCar = 0.6;
        const dmg = spd * 0.12; hurtPed(p, dmg, c.vx, c.vy, c.driver === 'player' ? 'player' : c.driver === 'cop' ? 'cop' : null);
        p.vx += c.vx * 0.7; p.vy += c.vy * 0.7; p.down = Math.max(p.down, 1.8); p.downT = 0;
        sound('hit'); fx.push({ t: 'txt', x: p.x, y: p.y - 40, text: pick(['SPLAT!', 'BONK!', 'WHAM!']), life: 0.7, max: 0.7, col: '#ffd23f' });
        if (c.driver === 'player') { G.crime(p.dead ? 2.2 : 0.9, p.x, p.y); witnessPanic(p.x, p.y, 380); }
      }
    };
    for (const p of peds) { if (p.hitByCar > 0) p.hitByCar -= 1 / 60; if (!p.dead) test(p, false); }
    if (pl && !pl.car && !pl.dead) test(pl, true);
  }

  // ================= update =================
  function update(dt, pl) {
    for (const c of cars) {
      c.age += dt; if (c.hitCd > 0) c.hitCd -= dt;
      if (c.burn > 0) { c.burn -= dt; c.thr = 0; c.brake = 0.3; if (c.burn <= 0) explodeCar(c); }
      if (c.wreck) { c.wreckT -= dt; }
      if (!c.wreck && c.hp < c.maxhp * 0.35 && Math.random() < dt * (c.hp < c.maxhp * 0.15 ? 14 : 5)) fx.push({ t: 'smoke', x: c.x + Math.cos(c.a) * c.len * 0.35, y: c.y + Math.sin(c.a) * c.len * 0.35, vx: rnd(-10, 10), vy: rnd(-40, -20), r: rnd(6, 12), life: rnd(0.6, 1.2), max: 1.2, col: c.hp < c.maxhp * 0.15 ? 50 : 140 });
      if (c.wreck && Math.random() < dt * 6) fx.push({ t: 'smoke', x: c.x + rnd(-14, 14), y: c.y + rnd(-8, 8), vx: rnd(-8, 8), vy: rnd(-45, -25), r: rnd(8, 14), life: rnd(0.8, 1.6), max: 1.6, col: 30 });
      if (c.burn > 0 && Math.random() < dt * 20) fx.push({ t: 'fire', x: c.x + rnd(-20, 20), y: c.y + rnd(-10, 10), vx: rnd(-10, 10), vy: rnd(-70, -30), r: rnd(8, 16), life: rnd(0.3, 0.6), max: 0.6 });
      if (c.driver === 'player') { /* controls set by game */ }
      else if (!c.wreck) {
        if (c.driver === 'npc') aiTraffic(c, dt);
        else if (c.driver === 'cop' || c.driver === 'rival') { if (G.player && !G.player.dead) aiChase(c, dt, G.player.car ? G.player.car : G.player); else { c.thr = 0; c.brake = 0.5; } }
        else { c.thr = 0; c.brake = 0.15; c.steer = 0; }
      }
      stepCar(c, dt);
      carCollideWorld(c);
      if (c.slip > 130 && Math.abs(c.speedF) > 60 && !c.wreck) {
        const f = { x: Math.cos(c.a), y: Math.sin(c.a) }, s = { x: -f.y, y: f.x };
        c.sk = c.sk || {};
        for (const sd of [-1, 1]) { const ox = -c.len * 0.3, oy = sd * (c.wid / 2 - 5), wx = c.x + f.x * ox + s.x * oy, wy = c.y + f.y * ox + s.y * oy, pv = c.sk[sd];
          if (pv) skids.push({ x: wx, y: wy, px: pv.x, py: pv.y, t: 14 }); c.sk[sd] = { x: wx, y: wy }; }
      } else c.sk = null;
    }
    for (let i = 0; i < cars.length; i++) for (let j = i + 1; j < cars.length; j++) carPair(cars[i], cars[j]);
    for (const c of cars) carVsPeds(c, pl);
    for (let i = peds.length - 1; i >= 0; i--) {
      const p = peds[i]; updatePed(p, dt, pl);
      if ((p.dead && p.deadT > 28) || (!p.keep && Math.hypot(p.x - pl.x, p.y - pl.y) > 1900) || (p.far > 6)) peds.splice(i, 1);
    }
    for (let i = cars.length - 1; i >= 0; i--) {
      const c = cars[i];
      if ((c.wreck && c.wreckT < 0) || (!c.keep && c.driver !== 'player' && Math.hypot(c.x - pl.x, c.y - pl.y) > 2100)) cars.splice(i, 1);
    }
    for (let i = pickups.length - 1; i >= 0; i--) {
      const k = pickups[i]; k.t += dt;
      const dx = pl.x - k.x, dy = pl.y - k.y;
      if (!pl.dead && dx * dx + dy * dy < (pl.car ? 55 * 55 : 36 * 36)) { G.addCash(k.amt); sound('cash'); fx.push({ t: 'txt', x: k.x, y: k.y - 20, text: '+$' + k.amt, life: 0.9, max: 0.9, col: '#6ee7a0' }); pickups.splice(i, 1); }
    }
    for (let i = fx.length - 1; i >= 0; i--) {
      const f = fx[i]; f.life -= dt; if (f.life <= 0) { fx.splice(i, 1); continue; }
      f.x += (f.vx || 0) * dt; f.y += (f.vy || 0) * dt; if (f.t === 'smoke') f.r += dt * 8; if (f.t === 'txt') f.y -= 30 * dt; if (f.t === 'ring') f.r += dt * 520;
    }
    for (let i = skids.length - 1; i >= 0; i--) { skids[i].t -= dt; if (skids[i].t <= 0) skids.splice(i, 1); }
    if (skids.length > 900) skids.splice(0, skids.length - 900);
  }

  // ================= drawing =================
  function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  function drawCar(ctx, c, time) {
    const L = c.len, W = c.wid, dead = c.wreck;
    ctx.save(); ctx.translate(c.x, c.y);
    // shadow + underglow
    ctx.save(); ctx.rotate(c.a); ctx.fillStyle = 'rgba(0,0,0,.32)'; rr(ctx, -L / 2 + 5, -W / 2 + 7, L, W, 10); ctx.fill();
    if (c.type === 'lowrider' && !dead) { const g = Math.sin(time * 3 + c.x) * 0.15 + 0.4; ctx.fillStyle = `rgba(255,79,216,${g})`; rr(ctx, -L / 2 - 6, -W / 2 - 6, L + 12, W + 12, 16); ctx.fill(); }
    ctx.restore();
    ctx.rotate(c.a);
    // wheels
    ctx.fillStyle = '#0b0b0f';
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) ctx.fillRect(sx * L * 0.3 - 8, sy * (W / 2 - 1) - 3, 16, 6);
    // body
    const body = dead ? '#222' : c.color;
    ctx.fillStyle = body; rr(ctx, -L / 2, -W / 2, L, W, 11); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,.22)'; rr(ctx, -L / 2 + 2, W * 0.14, L - 4, W * 0.36, 8); ctx.fill();       // lower shade
    ctx.fillStyle = 'rgba(255,255,255,.18)'; rr(ctx, -L / 2 + 6, -W / 2 + 3, L - 12, 5, 3); ctx.fill();
    if (c.type === 'police' && !dead) { ctx.fillStyle = '#f3f4f6'; ctx.fillRect(-L * 0.18, -W / 2, L * 0.36, W); ctx.fillStyle = '#111827'; ctx.fillRect(-L * 0.45, -W / 2, 6, W); }
    if (c.type === 'taxi' && !dead) { ctx.fillStyle = '#111'; for (let i = 0; i < 8; i++) if (i % 2 === 0) ctx.fillRect(-L / 2 + 8 + i * 10, -W / 2, 5, 4); }
    ctx.fillStyle = dead ? '#111' : 'rgba(0,0,0,.3)'; ctx.strokeStyle = 'rgba(0,0,0,.55)'; ctx.lineWidth = 2; rr(ctx, -L / 2, -W / 2, L, W, 11); ctx.stroke();
    // lights
    if (!dead) {
      const brake = c.brake > 0.2 || c.speedF < -5;
      ctx.fillStyle = '#fff6c8'; ctx.fillRect(L / 2 - 4, -W / 2 + 3, 4, 8); ctx.fillRect(L / 2 - 4, W / 2 - 11, 4, 8);
      ctx.fillStyle = brake ? '#ff2b2b' : '#8a1a1a'; ctx.fillRect(-L / 2, -W / 2 + 3, 4, 8); ctx.fillRect(-L / 2, W / 2 - 11, 4, 8);
    }
    // cabin raised (drawn up-screen for height)
    ctx.rotate(-c.a); ctx.translate(0, -7); ctx.rotate(c.a);
    const cl = c.type === 'van' ? L * 0.7 : L * 0.44;
    ctx.fillStyle = dead ? '#151515' : shadeCar(c.color, 0.78); rr(ctx, -cl * 0.55, -W * 0.42, cl, W * 0.84, 8); ctx.fill();
    ctx.fillStyle = dead ? '#0b0b0b' : '#243447'; rr(ctx, -cl * 0.55 + 5, -W * 0.42 + 4, cl - 10, W * 0.84 - 8, 6); ctx.fill();
    ctx.fillStyle = dead ? '#1a1a1a' : shadeCar(c.color, 0.9); rr(ctx, -cl * 0.55 + cl * 0.28, -W * 0.42 + 2, cl * 0.4, W * 0.84 - 4, 5); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.fillRect(cl * 0.2, -W * 0.38, 4, W * 0.76);
    if (c.type === 'police' && !dead) {
      const fl = Math.floor(time * 8) % 2;
      ctx.fillStyle = fl ? '#ff2a2a' : '#6a1111'; ctx.fillRect(-4, -W * 0.34, 8, W * 0.34); ctx.fillStyle = fl ? '#1a3cff' : '#0d1a66'; ctx.fillRect(-4, 0, 8, W * 0.34);
    }
    if (c.type === 'taxi' && !dead) { ctx.fillStyle = '#fff'; ctx.fillRect(-6, -4, 12, 8); }
    ctx.restore();
  }
  const shadeCache = {};
  function shadeCar(hex, f) {
    const k = hex + f; if (shadeCache[k]) return shadeCache[k];
    const n = parseInt(hex.slice(1), 16); return shadeCache[k] = `rgb(${Math.min(255, ((n >> 16) & 255) * f) | 0},${Math.min(255, ((n >> 8) & 255) * f) | 0},${Math.min(255, (n & 255) * f) | 0})`;
  }
  function pedPose(p, frame) {
    if (p.dead || p.down > 0) {
      let u;
      if (p.dead) u = Math.min(1, p.downT / 0.45);
      else if (p.down < 0.5) u = p.down / 0.5; else u = Math.min(1, p.downT / 0.4);
      return Poses.fall(u);
    }
    if (p.atk) { const m = Poses.Moves[p.atk.m]; return Poses.sample(m.kf, p.atk.t, m.base); }
    const sp = Math.hypot(p.vx, p.vy);
    if (sp > 18) return Poses.walk(p.walkPh, 1);
    return Poses.idle(frame + p.seed);
  }
  function drawPed(ctx, p, frame, time, opts) {
    const spr = Rig.sprites(p.char, p.hue);
    ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(p.x, p.y + 1, 17, 6, 0, 0, 7); ctx.fill();
    ctx.save();
    if (p.flash > 0) { ctx.filter = 'brightness(2.2)'; }
    Rig.draw(ctx, spr, pedPose(p, frame), p.x, p.y, p.face, p.scale);
    ctx.restore();
    ctx.filter = 'none';
    if (!p.dead && (p.kind === 'cop')) { const fl = Math.floor(time * 6 + p.seed) % 2; ctx.fillStyle = fl ? '#ff2a2a' : '#2a4cff'; ctx.beginPath(); ctx.arc(p.x, p.y - 74, 4, 0, 7); ctx.fill(); }
    if (p.hp < p.maxhp && !p.dead) { ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(p.x - 16, p.y - 70, 32, 5); ctx.fillStyle = p.kind === 'cop' ? '#4f7cff' : '#ef4444'; ctx.fillRect(p.x - 15, p.y - 69, 30 * p.hp / p.maxhp, 3); }
    if (p.label && !p.dead) { ctx.font = '900 11px "Arial Black", Impact, sans-serif'; ctx.textAlign = 'center'; ctx.lineWidth = 3; ctx.strokeStyle = '#000'; ctx.strokeText(p.label, p.x, p.y - 80); ctx.fillStyle = '#ffd23f'; ctx.fillText(p.label, p.x, p.y - 80); }
  }
  function drawFx(ctx, time) {
    for (const f of fx) {
      const a = Math.max(0, f.life / f.max);
      if (f.t === 'smoke') { ctx.fillStyle = `rgba(${f.col},${f.col},${f.col},${0.45 * a})`; ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, 7); ctx.fill(); }
      else if (f.t === 'fire') { ctx.fillStyle = `rgba(255,${(140 * a + 40) | 0},30,${0.85 * a})`; ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (0.5 + a * 0.6), 0, 7); ctx.fill(); }
      else if (f.t === 'spark') { ctx.fillStyle = `rgba(255,220,120,${a})`; ctx.fillRect(f.x, f.y, 3, 3); }
      else if (f.t === 'ring') { ctx.strokeStyle = `rgba(255,200,120,${a})`; ctx.lineWidth = 8 * a; ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, 7); ctx.stroke(); }
      else if (f.t === 'txt') {
        ctx.save(); ctx.translate(f.x, f.y); const s = 1 + (1 - a) * 0.2; ctx.scale(s, s); ctx.rotate(-0.12);
        ctx.font = 'italic 900 22px "Arial Black", Impact, sans-serif'; ctx.textAlign = 'center'; ctx.globalAlpha = Math.min(1, a * 2);
        ctx.lineWidth = 5; ctx.strokeStyle = '#1a0a2e'; ctx.strokeText(f.text, 0, 0); ctx.fillStyle = f.col || '#ffd23f'; ctx.fillText(f.text, 0, 0); ctx.restore();
      }
    }
  }
  function drawSkids(ctx, v) {
    ctx.strokeStyle = 'rgba(10,10,14,.45)'; ctx.lineWidth = 4; ctx.beginPath();
    for (const s of skids) { if (s.x < v.x0 || s.x > v.x1 || s.y < v.y0 || s.y > v.y1) continue; ctx.moveTo(s.px, s.py); ctx.lineTo(s.x, s.y); }
    ctx.stroke();
  }
  function drawPickups(ctx, time) {
    for (const k of pickups) {
      const b = Math.sin(k.t * 4) * 3;
      ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(k.x, k.y + 4, 9, 3, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#2fbf71'; ctx.fillRect(k.x - 9, k.y - 14 + b, 18, 11); ctx.strokeStyle = '#0b5d34'; ctx.lineWidth = 1.5; ctx.strokeRect(k.x - 9, k.y - 14 + b, 18, 11);
      ctx.fillStyle = '#e6ffe9'; ctx.font = '900 9px Arial'; ctx.textAlign = 'center'; ctx.fillText('$', k.x, k.y - 5 + b);
    }
  }

  // ================= spawning helpers =================
  function spawnTraffic(px, py, view) {
    for (let tries = 0; tries < 12; tries++) {
      const axis = Math.random() < 0.5 ? 0 : 1, k = Math.floor(Math.random() * (N + 1)), dir = axis === 0 ? (Math.random() < 0.5 ? 0 : 2) : (Math.random() < 0.5 ? 1 : 3);
      const along = rnd(80, SIZE - 80); let x, y;
      const lane = World.lanePoint(axis === 0 ? [0, k] : [k, 0], dir, 0);
      if (axis === 0) { x = along; y = lane.y; } else { x = lane.x; y = along; }
      const d = Math.hypot(x - px, y - py); if (d < view * 1.05 || d > view * 1.8) continue;
      // keep clear of intersections
      const ak = World.roadK(axis === 0 ? x : y); if (ak >= 0) continue;
      let ok = true; for (const c of cars) if (Math.hypot(c.x - x, c.y - y) < 130) { ok = false; break; } if (!ok) continue;
      const type = pick(['sedan', 'sedan', 'sedan', 'lowrider', 'lowrider', 'van', 'sport', 'taxi']);
      const c = makeCar(type, x, y, dir * Math.PI / 2, { driver: 'npc' });
      c.dir = dir; c.cruise = rnd(120, 185);
      const ni = axis === 0 ? (dir === 0 ? Math.ceil((x - R / 2) / P) : Math.floor((x - R / 2) / P)) : k;
      const nj = axis === 1 ? (dir === 1 ? Math.ceil((y - R / 2) / P) : Math.floor((y - R / 2) / P)) : k;
      c.node = [clamp(ni, 0, N), clamp(nj, 0, N)];
      c.vx = Math.cos(c.a) * 120; c.vy = Math.sin(c.a) * 120;
      return c;
    }
    return null;
  }
  function spawnPed(px, py, view) {
    for (let tries = 0; tries < 8; tries++) {
      const a = Math.random() * 7, d = rnd(view * 0.95, view * 1.7);
      const q = World.randomSidewalk(px + Math.cos(a) * d, py + Math.sin(a) * d, 120);
      const dd = Math.hypot(q.x - px, q.y - py); if (dd < view * 0.9) continue;
      const p = makePed('civ', q.x, q.y); p.hostile = Math.random() < 0.03; return p;
    }
  }
  function reset() { cars.length = peds.length = pickups.length = fx.length = skids.length = 0; }

  return { cars, peds, pickups, fx, skids, TYPES, makeCar, makePed, hurtPed, witnessPanic, update, drawCar, drawPed, drawFx, drawSkids, drawPickups, spawnTraffic, spawnPed, damageCar, sparks, reset, pedAttack, rnd, pick, angDiff, clamp };
})();
