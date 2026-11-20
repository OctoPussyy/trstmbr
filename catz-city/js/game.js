// Grand Theft Catz: main loop, input, player, wanted level, camera, lighting, HUD, title screen.
const G = {
  player: null, stars: 0, heat: 0, unseen: 0, cash: 0, rep: 0, hour: 18.9, shake() {}, crime() {}, addCash() {}, addRep() {}, setWanted() {}, hurtPlayer() {},
  onCarExplode() {}, onPedDown() {}, showEnding() {}, save() {}, notify() {},
};

(() => {
  const cvs = document.getElementById('c'), ctx = cvs.getContext('2d');
  const POI = World.POI, N = World.N, SIZE = World.SIZE;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), rnd = (a, b) => a + Math.random() * (b - a), pick = a => a[Math.floor(Math.random() * a.length)];
  let W = 0, H = 0, DPR = 1;
  function resize() { DPR = Math.min(2, window.devicePixelRatio || 1); W = cvs.clientWidth || innerWidth; H = cvs.clientHeight || innerHeight; cvs.width = Math.round(W * DPR); cvs.height = Math.round(H * DPR); }
  addEventListener('resize', resize); resize();

  // ---------- input ----------
  const keys = {}, pressed = {};
  const GAMEKEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab', 'KeyE', 'KeyJ', 'KeyK', 'KeyL', 'KeyR', 'KeyH', 'KeyQ', 'Enter', 'ShiftLeft', 'ShiftRight']);
  addEventListener('keydown', e => { Snd.init(); if (GAMEKEYS.has(e.code)) e.preventDefault(); if (!keys[e.code]) pressed[e.code] = true; keys[e.code] = true; });
  addEventListener('keyup', e => { keys[e.code] = false; });
  addEventListener('blur', () => { for (const k in keys) keys[k] = false; if (mode === 'play') paused = true; });

  // ---------- touch controls: floating stick on the left, buttons on the right ----------
  let touchMode = false;
  const stick = { id: null, ox: 0, oy: 0, x: 0, y: 0 }, held = new Map();
  function btns() {
    const S = clamp(H / 760, 0.8, 1.3), r = 32 * S, car = !!(P && P.car), b = [];
    b.push({ k: 'KeyE', x: W - 72 * S, y: H - 80 * S, r: 36 * S, l: 'ACT' });
    if (!car) b.push({ k: 'KeyJ', x: W - 160 * S, y: H - 62 * S, r, l: 'PUNCH' }, { k: 'KeyL', x: W - 66 * S, y: H - 170 * S, r, l: 'KICK' }, { k: 'KeyK', x: W - 154 * S, y: H - 148 * S, r: r * 0.85, l: 'CROSS' });
    else b.push({ k: 'Space', x: W - 160 * S, y: H - 62 * S, r, l: 'DRIFT' }, { k: 'KeyH', x: W - 66 * S, y: H - 170 * S, r: r * 0.8, l: 'HORN' }, { k: 'KeyR', x: W - 154 * S, y: H - 148 * S, r: r * 0.85, l: 'RADIO' });
    if (prompt.includes('Kevlar')) b.push({ k: 'KeyQ', x: W - 250 * S, y: H - 100 * S, r: r * 0.85, l: 'VEST' });
    b.push({ k: 'KeyP', x: 34, y: 34, r: 20, l: 'II' }, { k: 'Tab', x: 84, y: 34, r: 20, l: 'MAP' });
    return b;
  }
  function applyStick() {
    let dx = stick.x - stick.ox, dy = stick.y - stick.oy; const d = Math.hypot(dx, dy), lim = 60;
    if (d > lim) { stick.ox += dx / d * (d - lim); stick.oy += dy / d * (d - lim); dx = stick.x - stick.ox; dy = stick.y - stick.oy; }
    const set = (k, v) => { if (v && !keys[k]) pressed[k] = true; keys[k] = v; };
    set('KeyA', dx < -18); set('KeyD', dx > 18); set('KeyW', dy < -18); set('KeyS', dy > 18); set('ShiftLeft', Math.hypot(dx, dy) > 54);
  }
  function releaseStick() { stick.id = null; for (const k of ['KeyA', 'KeyD', 'KeyW', 'KeyS', 'ShiftLeft']) keys[k] = false; }
  function startGame() { Snd.init(); newGame(!!saved); }
  function titleTap(p) {
    const cw = Math.min(W / 3.2, 300);
    if (saved && p.x > W - 170 && p.y > H - 64) { Snd.init(); newGame(false); return; }
    const idx = p.y > H * 0.5 ? Math.round((p.x - W / 2) / cw) + 1 : -1;
    if (idx >= 0 && idx < 3 && idx !== sel) { sel = idx; return; }
    startGame();
  }
  cvs.addEventListener('pointerdown', e => {
    Snd.init();
    const r = cvs.getBoundingClientRect(), p = { x: e.clientX - r.left, y: e.clientY - r.top };
    if (e.pointerType !== 'mouse') touchMode = true;
    if (mode === 'title') { titleTap(p); return; }
    if (mode !== 'play') return;
    if (e.pointerType === 'mouse') { if (e.button === 0) pressed.Mouse0 = true; return; }
    e.preventDefault(); try { cvs.setPointerCapture(e.pointerId); } catch (x) { /* ignore */ }
    if (paused) { paused = false; return; } if (showMap) { showMap = false; return; } if (ending) { ending = false; return; }
    if (Missions.dialog) { pressed.KeyE = true; return; }
    for (const b of btns()) if (Math.hypot(p.x - b.x, p.y - b.y) < b.r + 12) { held.set(e.pointerId, b.k); keys[b.k] = true; pressed[b.k] = true; return; }
    if (stick.id === null && p.x < W * 0.6) { stick.id = e.pointerId; stick.ox = stick.x = p.x; stick.oy = stick.y = p.y; }
  });
  cvs.addEventListener('pointermove', e => {
    if (e.pointerId !== stick.id) return;
    const r = cvs.getBoundingClientRect(); stick.x = e.clientX - r.left; stick.y = e.clientY - r.top; applyStick();
  });
  const pend = e => { if (held.has(e.pointerId)) { keys[held.get(e.pointerId)] = false; held.delete(e.pointerId); } if (e.pointerId === stick.id) releaseStick(); };
  cvs.addEventListener('pointerup', pend); cvs.addEventListener('pointercancel', pend);
  cvs.addEventListener('contextmenu', e => e.preventDefault());
  function drawTouch() {
    if (!touchMode || mode !== 'play' || P.dead) return;
    ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    if (stick.id !== null) {
      ctx.strokeStyle = 'rgba(255,255,255,.45)'; ctx.lineWidth = 3; ctx.fillStyle = 'rgba(255,255,255,.08)'; ctx.beginPath(); ctx.arc(stick.ox, stick.oy, 60, 0, 7); ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(255,79,216,.6)'; ctx.beginPath(); ctx.arc(clamp(stick.x, stick.ox - 60, stick.ox + 60), clamp(stick.y, stick.oy - 60, stick.oy + 60), 26, 0, 7); ctx.fill();
    } else { ctx.strokeStyle = 'rgba(255,255,255,.2)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(96, H - 110, 56, 0, 7); ctx.stroke(); ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.font = '900 11px Arial'; ctx.fillText('DRAG TO MOVE', 96, H - 110); }
    for (const b of btns()) {
      const on = keys[b.k]; ctx.fillStyle = on ? 'rgba(255,210,63,.55)' : 'rgba(20,8,40,.5)'; ctx.strokeStyle = on ? '#ffd23f' : 'rgba(255,255,255,.6)'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, 7); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.font = `900 ${Math.max(9, b.r * 0.38)}px "Arial Black", Arial, sans-serif`; ctx.fillText(b.l, b.x, b.y + 1);
    }
    ctx.restore();
  }
  const down = (...c) => c.some(k => keys[k]), hit = (...c) => c.some(k => pressed[k]);

  // ---------- state ----------
  const CATS = [
    { id: 'prison', name: 'PRISON', tag: 'Ink. Knife. Zero chill.', hue: 0 },
    { id: 'crimson_paw', name: 'CRIMSON PAW', tag: 'Loud jacket. Louder mouth.', hue: 0 },
    { id: 'pimp_daddy', name: 'PIMP DADDY', tag: 'Purple suede. Gold chain.', hue: 0 },
  ];
  let mode = 'loading', sel = 0, T = 0, frame = 0, paused = false, showMap = false, last = 0, shakeT = 0, shakeA = 0, ending = false, deadMsg = '';
  let P = null, cam = { x: 0, y: 0, z: 1 }, notes = [], radioFlash = 0, radioName = '', saved = null, popT = 0, spawnT = 0, copT = 0, zone = '', zoneT = 0, sprayCd = 0, prompt = '', hitStop = 0;
  G.hour = 18.9;

  function loadSave() { try { const s = JSON.parse(localStorage.getItem('gtc_save') || 'null'); return s && typeof s.cash === 'number' ? s : null; } catch (e) { return null; } }
  G.save = () => { try { localStorage.setItem('gtc_save', JSON.stringify({ cash: G.cash, rep: G.rep, idx: Missions.idx, endless: Missions.endless, hue: P.hue, char: P.char, hour: G.hour })); } catch (e) { /* ignore */ } };
  G.notify = (t, col) => { notes.push({ t, col: col || '#fff', life: 4 }); if (notes.length > 4) notes.shift(); };
  G.shake = a => { shakeA = Math.max(shakeA, a); shakeT = 0.35; };
  G.addCash = a => { G.cash += a; };
  G.addRep = a => { G.rep += a; };
  G.showEnding = () => { ending = true; };

  // ---------- wanted level ----------
  const STAR_AT = [0.9, 3, 6, 10, 15];
  const starsFor = h => STAR_AT.filter(t => h >= t).length;
  G.crime = (amt, x, y) => {
    let seen = false;
    for (const c of Ents.cars) if (c.driver === 'cop' && Math.hypot(c.x - x, c.y - y) < 700) { seen = true; break; }
    if (!seen) for (const p of Ents.peds) if (!p.dead && (p.kind === 'cop' || (p.kind === 'civ' && Math.hypot(p.x - x, p.y - y) < 340))) { if (Math.hypot(p.x - x, p.y - y) < 700) { seen = true; break; } }
    G.heat = Math.min(20, G.heat + (seen ? amt : amt * 0.25)); G.unseen = 0;
    const s = starsFor(G.heat); if (s > G.stars) { G.stars = s; Snd.play('blip'); }
  };
  G.setWanted = n => { G.heat = Math.max(G.heat, STAR_AT[n - 1]); G.stars = starsFor(G.heat); G.unseen = 0; };
  function clearWanted() { G.heat = 0; G.stars = 0; G.unseen = 0; }

  G.hurtPlayer = (d, sx, sy, src) => {
    if (!P || P.dead || mode !== 'play') return;
    if (P.armor > 0) { const a = Math.min(P.armor, d * 0.7); P.armor -= a; d -= a; }
    P.hp -= d; P.flash = 0.2; Snd.play('hit'); G.shake(5);
    if (!P.car) { const dx = P.x - sx, dy = P.y - sy, l = Math.hypot(dx, dy) || 1; P.vx += dx / l * 90; P.vy += dy / l * 90; }
    if (P.hp <= 0) die('WASTED');
  };
  G.onCarExplode = c => {
    if (c.driver === 'player') G.hurtPlayer(999, c.x, c.y);
    else if (P && !P.dead && !P.car && Math.hypot(P.x - c.x, P.y - c.y) < 120) G.hurtPlayer(55, c.x, c.y);
    if (c.burnBy === 'player') G.crime(c.driver === 'cop' ? 4 : 1.5, c.x, c.y);
  };
  G.onPedDown = (p, src) => {
    if (src === 'player') { G.crime(p.kind === 'cop' ? 5 : p.kind === 'civ' ? 2.2 : 0.3, p.x, p.y); Ents.witnessPanic(p.x, p.y, 380); }
  };

  function die(kind) {
    if (P.dead) return;
    P.dead = true; P.deadT = 0; P.down = 1e9; P.downT = 0; P.atk = null; deadMsg = kind;
    if (P.car) { P.car.driver = null; P.car = null; }
    P.hidden = false;
    Snd.play(kind === 'BUSTED' ? 'busted' : 'wasted'); Snd.engine(0, 0, false); Snd.siren(0); Snd.skid(0);
    Missions.onDown(kind === 'BUSTED' ? 'You got busted' : 'You got wasted');
  }
  function respawn() {
    const busted = deadMsg === 'BUSTED', at = busted ? POI.jail : POI.home;
    G.cash = Math.max(0, G.cash - Math.round(G.cash * (busted ? 0.1 : 0.06)));
    P.hp = 100; P.armor = 0; P.dead = false; P.down = 0; P.hidden = false; P.x = at.x; P.y = at.y + 30; P.vx = P.vy = 0; P.bust = 0;
    clearWanted(); cam.x = P.x; cam.y = P.y;
    for (let i = Ents.peds.length - 1; i >= 0; i--) if (Ents.peds[i].kind === 'cop' || Ents.peds[i].kind === 'rival') Ents.peds.splice(i, 1);
    for (let i = Ents.cars.length - 1; i >= 0; i--) if (Ents.cars[i].driver === 'cop' || Ents.cars[i].driver === 'rival') Ents.cars.splice(i, 1);
    G.notify(busted ? 'Released. Lost 10% of your cash.' : 'Patched up at the safehouse. Lost 6% of your cash.', '#ffd23f');
  }

  // ---------- new game ----------
  function newGame(useSave) {
    Ents.reset(); Missions.reset(); clearWanted(); notes = [];
    G.cash = 250; G.rep = 0; G.hour = 18.9; Missions.idx = 0; Missions.endless = false;
    const c = CATS[sel];
    P = { kind: 'player', x: POI.home.x, y: POI.home.y + 34, vx: 0, vy: 0, face: 1, hp: 100, maxhp: 100, armor: 0, car: null, atk: null, walkPh: 0, stam: 1, dead: false, deadT: 0, down: 0, downT: 0, flash: 0,
      char: c.id, hue: c.hue, scale: 0.044, aim: { x: 1, y: 0 }, bust: 0, hidden: false, seed: 3, state: 'idle', thr: 0 };
    if (useSave && saved) { G.cash = saved.cash; G.rep = saved.rep; Missions.idx = saved.idx || 0; Missions.endless = !!saved.endless; P.hue = saved.hue || 0; P.char = saved.char || P.char; G.hour = saved.hour || G.hour; }
    G.player = P; cam.x = P.x; cam.y = P.y; cam.z = 1;
    for (let i = 0; i < 24; i++) Ents.spawnPed(P.x, P.y, 330);
    for (let i = 0; i < 16; i++) Ents.spawnTraffic(P.x, P.y, 520);
    mode = 'play'; paused = false; ending = false; zone = ''; Snd.init(); Snd.radioListen(false);
    Missions.say(['Welcome to Catz City, kitty. This is the hood.', 'WASD to move, SHIFT to run, J/K/L to throw paws, E to hop in cars.', 'Come find me at the yellow ! when you want work.'], () => {}, 'THE STREET');
  }

  // ---------- player ----------
  function exitCar() {
    const c = P.car; if (!c) return;
    const f = { x: Math.cos(c.a), y: Math.sin(c.a) }, s = { x: -f.y, y: f.x };
    const spots = [[0, -1], [0, 1], [-1.2, 0], [1.2, 0]];
    let best = null;
    for (const [fx, sx] of spots) {
      const px = c.x + f.x * fx * c.len * 0.5 + s.x * (sx * (c.wid / 2 + 24)) + (sx === 0 ? 0 : 0), py = c.y + f.y * fx * c.len * 0.5 + s.y * (sx * (c.wid / 2 + 24));
      const r = World.pushCircle(px, py, 12); if (!r.hit && !World.buildingAt(px, py)) { best = r; break; }
    }
    if (!best) best = World.pushCircle(c.x + s.x * -50, c.y + s.y * -50, 12);
    const sp = Math.abs(c.speedF);
    P.x = best.x; P.y = best.y; P.vx = c.vx * 0.4; P.vy = c.vy * 0.4; c.driver = null; c.thr = 0; c.brake = 0.4; c.steer = 0; c.hand = 1;
    P.car = null; P.hidden = false; Snd.engine(0, 0, false); Snd.skid(0); Snd.radioListen(false); Snd.play('door');
    if (sp > 300) G.hurtPlayer((sp - 250) * 0.12, c.x, c.y);
  }
  function enterCar(c) {
    if (c.driver && c.driver !== 'player') {
      const old = c.driver, f = { x: Math.cos(c.a), y: Math.sin(c.a) }, s = { x: -f.y, y: f.x };
      const ex = c.x + s.x * -(c.wid / 2 + 22), ey = c.y + s.y * -(c.wid / 2 + 22), q = World.pushCircle(ex, ey, 12);
      const ped = Ents.makePed(old === 'cop' ? 'cop' : old === 'rival' ? 'rival' : 'civ', q.x, q.y);
      if (ped.kind === 'civ') { ped.state = 'flee'; ped.flee = 7; ped.thx = P.x; ped.thy = P.y; ped.down = 0.6; }
      Ents.fx.push({ t: 'txt', x: c.x, y: c.y - 40, text: pick(['HEY!', 'MY RIDE!', 'NOOO!']), life: 0.9, max: 0.9, col: '#fff' });
      G.crime(old === 'cop' ? 4 : 2, c.x, c.y); Ents.witnessPanic(c.x, c.y, 380);
    }
    c.driver = 'player'; c.mode = 'player'; c.route.length = 0; c.keep = false; P.car = c; P.hidden = true; P.vx = P.vy = 0;
    Snd.play('door'); Snd.radioListen(true); radioFlash = 2.5; radioName = Snd.names[Snd.station];
  }
  function startAttack(m, dmg) {
    P.atk = { m, t: 0, done: false, dmg };
  }
  function playerHit() {
    const mv = Poses.Moves[P.atk.m]; let any = false;
    const kd = P.atk.m === 'HK' || P.atk.m === 'HP';
    for (const p of Ents.peds) {
      if (p.dead) continue;
      const dx = p.x - P.x, dy = p.y - P.y, d = Math.hypot(dx, dy);
      if (d < 86 && (d < 30 || (dx * P.aim.x + dy * P.aim.y) / d > 0.15)) {
        any = true; Ents.hurtPed(p, P.atk.dmg, dx, dy, 'player');
        if (kd && !p.dead) { p.down = Math.max(p.down, 1.2); p.downT = 0; }
        if (!p.dead) G.crime(p.kind === 'cop' ? 3 : p.kind === 'civ' ? 0.55 : 0.08, p.x, p.y);
        Ents.fx.push({ t: 'txt', x: p.x, y: p.y - 56, text: pick(['POW!', 'BAM!', 'WHAP!', 'SMACK!']), life: 0.5, max: 0.5, col: pick(['#ffd23f', '#ff4fd8', '#3ec8ff']) });
        Ents.sparks(p.x, p.y - 30, 4);
      }
    }
    if (any) { Snd.play('punch'); G.shake(3); hitStop = 0.04; Ents.witnessPanic(P.x, P.y, 300); } else Snd.play('whoosh');
  }
  function updateFoot(dt) {
    let ax = (down('KeyD', 'ArrowRight') ? 1 : 0) - (down('KeyA', 'ArrowLeft') ? 1 : 0), ay = (down('KeyS', 'ArrowDown') ? 1 : 0) - (down('KeyW', 'ArrowUp') ? 1 : 0);
    const len = Math.hypot(ax, ay); if (len) { ax /= len; ay /= len; }
    const sprint = down('ShiftLeft', 'ShiftRight') && P.stam > 0.05 && len > 0;
    P.stam = clamp(P.stam + (sprint ? -0.28 : 0.22) * dt, 0, 1);
    let sp = sprint ? 285 : 160; if (P.atk) sp *= 0.25; if (P.down > 0) sp = 0;
    P.vx += (ax * sp - P.vx) * Math.min(1, dt * 12); P.vy += (ay * sp - P.vy) * Math.min(1, dt * 12);
    if (len && !P.atk) { P.aim = { x: ax, y: ay }; if (ax !== 0) P.face = Math.sign(ax); }
    if (P.down > 0) { P.down -= dt; P.downT += dt; }
    const r = World.pushCircle(P.x + P.vx * dt, P.y + P.vy * dt, 11); P.x = r.x; P.y = r.y;
    P.walkPh += Math.hypot(P.vx, P.vy) * dt * 0.052;
    if (P.atk) {
      const mv = Poses.Moves[P.atk.m]; P.atk.t += dt * 60;
      if (!P.atk.done && P.atk.t >= mv.S) { P.atk.done = true; playerHit(); }
      if (P.atk.t >= mv.total) P.atk = null;
    } else if (P.down <= 0) {
      if (hit('KeyJ', 'Mouse0')) startAttack('LP', 9);
      else if (hit('KeyK')) startAttack('HP', 17);
      else if (hit('KeyL')) startAttack('LK', 13);
    }
    if (hit('KeyE')) interact();
    if (hit('KeyQ')) { const d = Math.hypot(P.x - POI.bodega.x, P.y - POI.bodega.y); if (d < 70) buy('vest'); }
  }
  function buy(what) {
    const costs = { snack: 20, vest: 100, fits: 50 };
    if (G.cash < costs[what]) { G.notify('Not enough cash.', '#ff6b6b'); return; }
    G.cash -= costs[what]; Snd.play('buy');
    if (what === 'snack') { P.hp = Math.min(P.maxhp, P.hp + 50); G.notify('Hot wings! +50 health', '#3ef2a0'); }
    if (what === 'vest') { P.armor = Math.min(100, P.armor + 50); G.notify('Kevlar up! +50 armor', '#4fc3ff'); }
    if (what === 'fits') { P.hue = (P.hue + 40) % 360; G.notify('Fresh fits. Looking clean.', '#ff4fd8'); }
  }
  function interact() {
    const d = k => Math.hypot(P.x - POI[k].x, P.y - POI[k].y);
    if (d('home') < 70) {
      if (G.stars) { G.notify('Cops are watching. Lose them first.', '#ff6b6b'); return; }
      G.hour = (G.hour + 8) % 24; P.hp = P.maxhp; G.save(); Snd.play('buy'); G.notify('Slept it off. Game saved.', '#4fc3ff'); return;
    }
    if (d('fits') < 70) { buy('fits'); return; }
    if (d('bodega') < 70) { buy('snack'); return; }
    let best = null, bd = 80;
    for (const c of Ents.cars) { if (c.wreck || c.burn > 0) continue; const dd = Math.hypot(c.x - P.x, c.y - P.y); if (dd < bd) { bd = dd; best = c; } }
    if (best) enterCar(best);
  }
  function updateCar(dt) {
    const c = P.car;
    c.thr = down('KeyW', 'ArrowUp') ? 1 : 0; c.brake = down('KeyS', 'ArrowDown') ? 1 : 0;
    c.steer = (down('KeyD', 'ArrowRight') ? 1 : 0) - (down('KeyA', 'ArrowLeft') ? 1 : 0); c.hand = down('Space') ? 1 : 0;
    if (hit('KeyH')) { Snd.play('horn'); for (const o of Ents.cars) if (o.driver === 'npc' && Math.hypot(o.x - c.x, o.y - c.y) < 300) o.ghost = 0; }
    if (hit('KeyE')) exitCar();
    P.x = c.x; P.y = c.y; P.vx = c.vx; P.vy = c.vy;
    if (hit('KeyR')) { radioName = Snd.nextStation(); radioFlash = 3; }
    if (c.wreck || c.burn > 0 && c.burn < 1.2 && false) { /* handled in explode */ }
  }

  // ---------- world management ----------
  function viewRadius() { return Math.hypot(W / 2, H / 2) / cam.z + 120; }
  function manage(dt) {
    const vr = viewRadius(), dark = darkness();
    const wantC = Math.round(20 - dark * 5), wantP = Math.round(36 - dark * 12);
    popT -= dt; if (popT <= 0) {
      popT = 0.12;
      let nc = 0, np = 0; for (const c of Ents.cars) if (c.driver === 'npc') nc++; for (const p of Ents.peds) if (p.kind === 'civ' && !p.dead) np++;
      if (nc < wantC) Ents.spawnTraffic(P.x, P.y, vr);
      if (np < wantP) Ents.spawnPed(P.x, P.y, vr);
    }
    // cops
    if (G.stars > 0) {
      copT -= dt;
      if (copT <= 0) {
        copT = 2.4;
        let cc = 0, cf = 0; for (const c of Ents.cars) if (c.driver === 'cop' && !c.wreck) cc++; for (const p of Ents.peds) if (p.kind === 'cop' && !p.dead) cf++;
        if (cc < G.stars + (G.stars > 3 ? 0 : 0)) spawnCopCar(vr);
        if (G.stars >= 2 && cf < Math.min(4, G.stars - 1)) spawnCopFoot(vr);
      }
      // line of sight / decay
      let seen = false;
      for (const c of Ents.cars) if (c.driver === 'cop' && !c.wreck) { const d = Math.hypot(c.x - P.x, c.y - P.y); if (d < 320 || (d < 700 && World.los(c.x, c.y, P.x, P.y))) { seen = true; break; } }
      if (!seen) for (const p of Ents.peds) if (p.kind === 'cop' && !p.dead) { const d = Math.hypot(p.x - P.x, p.y - P.y); if (d < 260 || (d < 600 && World.los(p.x, p.y, P.x, P.y))) { seen = true; break; } }
      if (seen) G.unseen = 0; else G.unseen += dt;
      if (G.unseen > 6) { G.heat -= dt * 1.6; if (G.heat < STAR_AT[G.stars - 1] - 0.3) G.stars = Math.max(0, G.stars - 1); if (G.heat <= 0.4) { clearWanted(); G.notify('Wanted level lost.', '#3ef2a0'); } }
    } else {
      G.heat = Math.max(0, G.heat - dt * 0.08);
      for (let i = Ents.peds.length - 1; i >= 0; i--) { const p = Ents.peds[i]; if (p.kind === 'cop' && !p.dead) { p.kind = 'civ'; p.state = 'idle'; p.hostile = false; p.t = 1; } }
      for (const c of Ents.cars) if (c.driver === 'cop') {
        c.driver = 'npc'; c.mode = 'traffic'; c.route.length = 0; c.cruise = 230;
        const d = Math.round(((c.a % 6.2832) + 6.2832) % 6.2832 / (Math.PI / 2)) % 4; c.dir = d;
        const n = World.nearestNode(c.x + World.DX[d] * 160, c.y + World.DY[d] * 160); c.node = n;
      }
    }
    // arrest
    if (!P.dead) {
      let near = false;
      for (const p of Ents.peds) if (p.kind === 'cop' && !p.dead && p.down <= 0 && Math.hypot(p.x - P.x, p.y - P.y) < 54 && (!P.car || Math.abs(P.car.speedF) < 60)) { near = true; break; }
      P.bust = near ? P.bust + dt : Math.max(0, P.bust - dt * 0.8);
      if (P.bust > 1.8) die('BUSTED');
    }
  }
  function spawnCopCar(vr) {
    for (let t = 0; t < 10; t++) {
      const a = Math.random() * 6.28, d = vr * rnd(1.0, 1.35), n = World.nearestNode(P.x + Math.cos(a) * d, P.y + Math.sin(a) * d);
      const x = World.center(n[0]), y = World.center(n[1]);
      if (Math.hypot(x - P.x, y - P.y) < vr * 0.9) continue;
      const c = Ents.makeCar('police', x, y, Math.atan2(P.y - y, P.x - x), { driver: 'cop', mode: 'chase' }); c.keep = false; return;
    }
  }
  function spawnCopFoot(vr) {
    const a = Math.random() * 6.28, q = World.randomSidewalk(P.x + Math.cos(a) * vr, P.y + Math.sin(a) * vr, 100);
    if (Math.hypot(q.x - P.x, q.y - P.y) < vr * 0.85) return; Ents.makePed('cop', q.x, q.y);
  }

  // ---------- day / night ----------
  const AMB = [[0, [78, 86, 160]], [5, [92, 98, 168]], [6.5, [255, 195, 175]], [8, [255, 255, 255]], [16.5, [255, 255, 255]], [18, [255, 208, 165]], [19.5, [238, 142, 205]], [21, [118, 108, 190]], [24, [78, 86, 160]]];
  function ambient() {
    const h = G.hour; for (let i = 1; i < AMB.length; i++) if (h <= AMB[i][0]) {
      const [h0, a] = AMB[i - 1], [h1, b] = AMB[i], u = (h - h0) / (h1 - h0); return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u];
    } return AMB[0][1];
  }
  const darkness = () => { const a = ambient(); return 1 - (a[0] + a[1] + a[2]) / 765; };

  // ---------- update ----------
  function update(dt) {
    T += dt; G.hour = (G.hour + dt * 24 / 480) % 24;
    if (hitStop > 0) { hitStop -= dt; return; }
    if (shakeT > 0) shakeT -= dt; else shakeA = 0;
    for (const n of notes) n.life -= dt; notes = notes.filter(n => n.life > 0);
    if (radioFlash > 0) radioFlash -= dt;
    if (sprayCd > 0) sprayCd -= dt;
    if (P.flash > 0) P.flash -= dt;
    if (Missions.dialog && hit('KeyE', 'Enter', 'Space')) { Missions.advance(); pressed.KeyE = pressed.Enter = pressed.Space = false; }
    if (P.dead) {
      P.deadT += dt; P.downT += dt; Ents.update(dt, P);
      if (P.deadT > 3.8) respawn();
      return;
    }
    if (P.car) updateCar(dt); else updateFoot(dt);
    Ents.update(dt, P);
    if (P.car) { P.x = P.car.x; P.y = P.car.y; if (P.car.wreck && !P.dead) { P.car = null; P.hidden = false; } }
    manage(dt);
    Missions.update(dt);
    poiLogic(dt);
    // camera
    const car = P.car, spd = car ? Math.hypot(car.vx, car.vy) : 0;
    const tz = (H / 760) * (car ? 0.86 - Math.min(0.24, spd / 2600) : 1);
    cam.z += (tz - cam.z) * Math.min(1, dt * 2.5);
    const lead = car ? 0.42 : 0.12, tx = P.x + P.vx * lead, ty = P.y + P.vy * lead;
    cam.x += (tx - cam.x) * Math.min(1, dt * 5); cam.y += (ty - cam.y) * Math.min(1, dt * 5);
    // zone name
    const zn = World.districtAt(P.x, P.y); if (zn !== zone) { zone = zn; zoneT = 3.5; } if (zoneT > 0) zoneT -= dt;
    // audio
    let sirenV = 0; for (const c of Ents.cars) if (c.driver === 'cop' && !c.wreck) sirenV = Math.max(sirenV, 1 - Math.hypot(c.x - P.x, c.y - P.y) / 900);
    Snd.siren(sirenV); Snd.amb(P.car ? 0 : 1);
    if (P.car) { Snd.engine(Math.abs(P.car.speedF), P.car.thr, true); Snd.skid(P.car.slip > 140 && Math.abs(P.car.speedF) > 60 ? clamp((P.car.slip - 120) / 250, 0, 1) : 0); } else { Snd.engine(0, 0, false); Snd.skid(0); }
  }
  function poiLogic(dt) {
    prompt = '';
    if (P.dead) return;
    const d = k => Math.hypot(P.x - POI[k].x, P.y - POI[k].y);
    if (!P.car) {
      if (d('home') < 70) prompt = '[E] Sleep & save game';
      else if (d('fits') < 70) prompt = '[E] New fits — $50';
      else if (d('bodega') < 70) prompt = '[E] Hot wings +50 HP $20    [Q] Kevlar vest $100';
      else if (!Missions.active && d('og') < 80 && !Missions.dialog) prompt = 'OG Whiskers is waiting…';
      else { let b = 80; for (const c of Ents.cars) { if (c.wreck || c.burn > 0) continue; const dd = Math.hypot(c.x - P.x, c.y - P.y); if (dd < b) { b = dd; prompt = c.driver && c.driver !== 'player' ? '[E] Carjack' : '[E] Enter car'; } } }
    } else {
      prompt = '';
      if (d('spray') < 100 && sprayCd <= 0 && Math.abs(P.car.speedF) < 140) {
        if (G.cash < 75) { G.notify('Pay-n-Spray costs $75.', '#ff6b6b'); sprayCd = 5; }
        else {
          let cop = false; for (const c of Ents.cars) if (c.driver === 'cop' && Math.hypot(c.x - P.x, c.y - P.y) < 300) cop = true;
          if (cop && G.stars) { G.notify('Cops are too close for a respray!', '#ff6b6b'); sprayCd = 4; }
          else if (G.stars || P.car.hp < P.car.maxhp * 0.98) { G.cash -= 75; P.car.hp = P.car.maxhp; if (G.stars) { clearWanted(); G.notify('Fresh paint. Wanted level cleared!', '#3ef2a0'); } else G.notify('Car repaired. $75', '#3ef2a0'); Snd.play('buy'); sprayCd = 8; }
        }
      }
    }
  }

  // ---------- rendering ----------
  const upright = [], decor = [];
  function render() {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    if (mode === 'loading') { ctx.fillStyle = '#0b0614'; ctx.fillRect(0, 0, W, H); txt('LOADING CATZ…', W / 2, H / 2, 28, '#ff4fd8', 'center'); return; }
    if (mode === 'title') { drawTitle(); return; }
    drawWorld();
    drawHUD();
    drawTouch();
  }
  function drawWorld() {
    const z = cam.z, hw = W / 2 / z + 140, hh = H / 2 / z + 160;
    const sx = shakeT > 0 ? rnd(-1, 1) * shakeA : 0, sy = shakeT > 0 ? rnd(-1, 1) * shakeA : 0;
    const v = { x0: cam.x - hw, x1: cam.x + hw, y0: cam.y - hh, y1: cam.y + hh };
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    ctx.save(); ctx.translate(W / 2, H / 2); ctx.scale(z, z); ctx.translate(-cam.x + sx, -cam.y + sy);
    World.drawGround(ctx, v); Ents.drawSkids(ctx, v);
    const marks = Missions.markers();
    // ground markers (missions + POIs)
    for (const k in POI) { const p = POI[k]; if (k === 'og' || k === 'jail' && false) continue; drawPoiGround(p, v); }
    for (const m of marks) drawMarkerGround(m, v);
    Ents.drawPickups(ctx, T);
    World.drawBuildings(ctx, v);
    // cars
    const cars = Ents.cars.filter(c => c.x > v.x0 - 80 && c.x < v.x1 + 80 && c.y > v.y0 - 80 && c.y < v.y1 + 80).sort((a, b) => a.y - b.y);
    for (const c of cars) Ents.drawCar(ctx, c, T);
    // upright things
    upright.length = 0; decor.length = 0;
    World.decorList(v, decor); for (const d of decor) upright.push({ y: d.y, d });
    for (const p of Ents.peds) if (p.x > v.x0 - 60 && p.x < v.x1 + 60 && p.y > v.y0 - 20 && p.y < v.y1 + 120) upright.push({ y: p.y + (p.dead ? -30 : 0), p });
    if (!P.hidden) upright.push({ y: P.y, p: P, me: true });
    upright.push({ y: POI.og.y, og: true });
    upright.sort((a, b) => a.y - b.y);
    for (const u of upright) {
      if (u.d) World.drawDecor(ctx, u.d, T);
      else if (u.og) drawOG();
      else if (u.me) { Ents.drawPed(ctx, P, frame, T); }
      else Ents.drawPed(ctx, u.p, frame, T);
    }
    Ents.drawFx(ctx, T);
    for (const m of marks) drawMarkerAir(m);
    for (const k in POI) drawPoiLabel(POI[k], v);
    ctx.restore();
    // ambient light
    const a = ambient(), dark = darkness();
    if (dark > 0.02 || a[0] + a[1] + a[2] < 760) { ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = `rgb(${a[0] | 0},${a[1] | 0},${a[2] | 0})`; ctx.fillRect(0, 0, W, H); ctx.globalCompositeOperation = 'source-over'; }
    // additive lights
    ctx.save(); ctx.translate(W / 2, H / 2); ctx.scale(z, z); ctx.translate(-cam.x + sx, -cam.y + sy);
    if (dark > 0.15) World.drawLights(ctx, v, clamp(dark * 1.6, 0, 1));
    drawCarLights(cars, clamp(dark * 1.5, 0, 1));
    ctx.restore();
    // vignette
    const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.45, W / 2, H / 2, Math.max(W, H) * 0.8);
    vg.addColorStop(0, 'rgba(10,0,30,0)'); vg.addColorStop(1, 'rgba(10,0,30,.42)'); ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
    if (P.flash > 0) { ctx.fillStyle = `rgba(255,40,40,${P.flash * 1.2})`; ctx.fillRect(0, 0, W, H); }
    if (G.stars > 0) { const fl = Math.floor(T * 3) % 2; const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.4, W / 2, H / 2, Math.max(W, H) * 0.75); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, fl ? 'rgba(255,30,60,.22)' : 'rgba(30,70,255,.22)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
  }
  function drawCarLights(cars, k) {
    ctx.globalCompositeOperation = 'lighter';
    for (const c of cars) {
      if (c.wreck) continue;
      const f = { x: Math.cos(c.a), y: Math.sin(c.a) };
      if (k > 0.1) {
        const gx = c.x + f.x * (c.len / 2 + 60), gy = c.y + f.y * (c.len / 2 + 60), g = ctx.createRadialGradient(gx, gy, 6, gx, gy, 130);
        g.addColorStop(0, `rgba(255,240,190,${0.38 * k})`); g.addColorStop(1, 'rgba(255,240,190,0)'); ctx.fillStyle = g; ctx.fillRect(gx - 130, gy - 130, 260, 260);
        const bx = c.x - f.x * c.len / 2, by = c.y - f.y * c.len / 2, g2 = ctx.createRadialGradient(bx, by, 2, bx, by, 40);
        g2.addColorStop(0, `rgba(255,40,40,${(c.brake > 0.2 ? 0.7 : 0.3) * k})`); g2.addColorStop(1, 'rgba(255,40,40,0)'); ctx.fillStyle = g2; ctx.fillRect(bx - 40, by - 40, 80, 80);
      }
      if (c.type === 'police') {
        const fl = Math.floor(T * 8) % 2, gr = ctx.createRadialGradient(c.x, c.y - 6, 4, c.x, c.y - 6, 110);
        gr.addColorStop(0, fl ? 'rgba(255,40,60,.55)' : 'rgba(40,80,255,.55)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = gr; ctx.fillRect(c.x - 110, c.y - 116, 220, 220);
      }
      if (c.type === 'lowrider') { const g3 = ctx.createRadialGradient(c.x, c.y, 10, c.x, c.y, 90); g3.addColorStop(0, `rgba(255,79,216,${0.25 * (0.4 + k)})`); g3.addColorStop(1, 'rgba(255,79,216,0)'); ctx.fillStyle = g3; ctx.fillRect(c.x - 90, c.y - 90, 180, 180); }
    }
    for (const f of Ents.fx) if (f.t === 'fire') { const a = f.life / f.max, g = ctx.createRadialGradient(f.x, f.y, 2, f.x, f.y, f.r * 3.2); g.addColorStop(0, `rgba(255,150,40,${0.4 * a})`); g.addColorStop(1, 'rgba(255,100,0,0)'); ctx.fillStyle = g; ctx.fillRect(f.x - f.r * 3.2, f.y - f.r * 3.2, f.r * 6.4, f.r * 6.4); }
    ctx.globalCompositeOperation = 'source-over';
  }
  const ogP = { x: 0, y: 0, face: -1, char: 'pimp_daddy', hue: 0, scale: 0.046, vx: 0, vy: 0, walkPh: 0, atk: null, dead: false, down: 0, downT: 0, flash: 0, hp: 1, maxhp: 1, kind: 'og', seed: 9, label: null };
  function drawOG() { ogP.x = POI.og.x; ogP.y = POI.og.y + 6; ogP.face = P.x < ogP.x ? -1 : 1; Ents.drawPed(ctx, ogP, frame, T); }
  function drawPoiGround(p, v) {
    if (p.x < v.x0 || p.x > v.x1 || p.y < v.y0 || p.y > v.y1) return;
    if (p.id === 'stash' || p.id === 'og') return;
    const pulse = 0.5 + 0.5 * Math.sin(T * 3);
    ctx.fillStyle = p.col + '33'; ctx.beginPath(); ctx.arc(p.x, p.y, 38 + pulse * 5, 0, 7); ctx.fill();
    ctx.strokeStyle = p.col; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(p.x, p.y, 38, 0, 7); ctx.stroke();
  }
  function drawPoiLabel(p, v) {
    if (p.id === 'stash' && !(Missions.active)) return;
    if (p.x < v.x0 || p.x > v.x1 || p.y < v.y0 || p.y > v.y1) return;
    txt(p.name, p.x, p.y - 62, 13, '#fff', 'center', 3);
  }
  function drawMarkerGround(m, v) {
    if (m.x < v.x0 - 100 || m.x > v.x1 + 100 || m.y < v.y0 - 100 || m.y > v.y1 + 100) return;
    const pulse = 0.5 + 0.5 * Math.sin(T * 4), r = Math.min(m.r || 60, 90);
    ctx.fillStyle = m.col + '40'; ctx.beginPath(); ctx.arc(m.x, m.y, r * (0.85 + pulse * 0.15), 0, 7); ctx.fill();
    ctx.strokeStyle = m.col; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(m.x, m.y, r, 0, 7); ctx.stroke();
  }
  function drawMarkerAir(m) {
    const b = Math.sin(T * 5) * 5;
    ctx.fillStyle = m.col; ctx.strokeStyle = '#000'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(m.x, m.y - 90 + b); ctx.lineTo(m.x - 12, m.y - 108 + b); ctx.lineTo(m.x + 12, m.y - 108 + b); ctx.closePath(); ctx.stroke(); ctx.fill();
    if (m.icon) txt(m.icon, m.x, m.y - 118 + b, 26, m.col, 'center', 4);
    if (m.label) txt(m.label, m.x, m.y - 124 + b - (m.icon ? 20 : 0), 13, '#fff', 'center', 3);
  }

  // ---------- HUD ----------
  function txt(s, x, y, size, col, align, stroke) {
    ctx.font = `900 ${size}px "Arial Black", Impact, "Helvetica Neue", sans-serif`; ctx.textAlign = align || 'left'; ctx.textBaseline = 'alphabetic';
    if (stroke) { ctx.lineWidth = stroke; ctx.strokeStyle = '#150a25'; ctx.lineJoin = 'round'; ctx.strokeText(s, x, y); }
    ctx.fillStyle = col || '#fff'; ctx.fillText(s, x, y);
  }
  function star(x, y, r, col) {
    ctx.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } ctx.closePath();
    ctx.fillStyle = col; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#150a25'; ctx.stroke();
  }
  const fmt = n => Math.floor(n).toLocaleString('en-US');
  function clock() { const h = Math.floor(G.hour), m = Math.floor((G.hour % 1) * 60); return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`; }
  function drawHUD() {
    const m = 18, S = clamp(H / 760, 0.8, 1.4);
    // money
    txt('$' + fmt(G.cash), W - m, m + 36 * S, 36 * S, '#4ade80', 'right', 6);
    // bars
    const bw = 190 * S, bx = W - m - bw, by = m + 52 * S;
    ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(bx - 3, by - 3, bw + 6, 14 * S + 6);
    ctx.fillStyle = '#7f1d1d'; ctx.fillRect(bx, by, bw, 14 * S); ctx.fillStyle = '#ef4444'; ctx.fillRect(bx, by, bw * clamp(P.hp / 100, 0, 1), 14 * S);
    if (P.armor > 0) { ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(bx - 3, by + 20 * S - 3, bw + 6, 9 * S + 6); ctx.fillStyle = '#38bdf8'; ctx.fillRect(bx, by + 20 * S, bw * P.armor / 100, 9 * S); }
    // stars
    for (let i = 0; i < 5; i++) { const on = i < G.stars, fl = on && G.unseen < 0.1 && Math.floor(T * 4) % 2; star(W - m - 14 * S - (4 - i) * 30 * S, by + 54 * S, 12 * S, on ? (fl ? '#ffffff' : '#ffd23f') : 'rgba(255,255,255,.18)'); }
    txt(clock() + '  ·  RESPECT ' + G.rep, W - m, by + 86 * S, 12 * S, '#e9d5ff', 'right', 3);
    drawMinimap(S);
    if (zoneT > 0 || true) { txt(zone.toUpperCase(), m + 8, H - m - 2 * 96 * S - 14, 15 * S, '#ff9ad5', 'left', 4); }
    // radio
    if (radioFlash > 0 && P.car) { ctx.globalAlpha = Math.min(1, radioFlash); txt('♪ ' + radioName, W / 2, 34 * S, 16 * S, '#7dd3fc', 'center', 4); ctx.globalAlpha = 1; }
    // objective
    const ob = Missions.objective();
    let line1 = '', line2 = '';
    if (ob) { line1 = ob.title.toUpperCase() + (ob.steps > 1 ? `   ${ob.step}/${ob.steps}` : ''); line2 = ob.text + (ob.time !== null ? `   ⏱ ${Math.ceil(ob.time)}s` : ''); }
    else if (!Missions.dialog) { line1 = 'FREE ROAM'; line2 = Missions.idx < Missions.total ? 'Find OG Whiskers at the yellow ! for work' : 'Find OG Whiskers for courier jobs — or just cause chaos'; }
    const bwid = Math.min(W - 40, 560 * S, touchMode ? W - 520 : 9999);
    ctx.fillStyle = 'rgba(15,5,35,.72)'; ctx.fillRect(W / 2 - bwid / 2, H - m - 62 * S, bwid, 56 * S);
    ctx.fillStyle = ob ? '#ffd23f' : '#c084fc'; ctx.fillRect(W / 2 - bwid / 2, H - m - 62 * S, 5, 56 * S);
    txt(line1, W / 2 - bwid / 2 + 16, H - m - 40 * S, 13 * S, ob ? '#ffd23f' : '#c084fc', 'left', 3);
    txt(line2, W / 2 - bwid / 2 + 16, H - m - 16 * S, 15 * S, '#fff', 'left', 3);
    if (prompt && !Missions.dialog) txt(touchMode ? prompt.replace(/\[E\]/g, '[ACT]').replace(/\[Q\]/g, '[VEST]') : prompt, W / 2, H - m - 76 * S, 16 * S, '#fff', 'center', 5);
    // notes
    let ny = m + (touchMode ? 78 : 22); for (const n of notes) { ctx.globalAlpha = Math.min(1, n.life); txt(n.t, m, ny, 14 * S, n.col, 'left', 4); ctx.globalAlpha = 1; ny += 22 * S; }
    drawDialog(S);
    const b = Missions.banner;
    if (b) { const a = Math.min(1, b.t * 1.5), k = 1 + (1 - Math.min(1, (4 - b.t) * 4)) * 0.2; ctx.globalAlpha = a; txt(b.text, W / 2, H * 0.3, 54 * S * Math.min(1, k), b.col, 'center', 9); txt(b.sub, W / 2, H * 0.3 + 34 * S, 20 * S, '#fff', 'center', 5); ctx.globalAlpha = 1; }
    if (P.dead) {
      const u = clamp(P.deadT / 1.2, 0, 1); ctx.fillStyle = `rgba(0,0,0,${0.55 * u})`; ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = u; txt(deadMsg, W / 2, H / 2 + 20, 120 * S, deadMsg === 'BUSTED' ? '#60a5fa' : '#ef4444', 'center', 12); ctx.globalAlpha = 1;
    }
    if (showMap) drawBigMap();
    if (paused) drawPause();
    if (ending) drawEnding();
    if (P.bust > 0.1 && !P.dead) { ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(W / 2 - 90, H / 2 + 90, 180, 10); ctx.fillStyle = '#60a5fa'; ctx.fillRect(W / 2 - 88, H / 2 + 92, 176 * clamp(P.bust / 1.8, 0, 1), 6); txt('BEING ARRESTED', W / 2, H / 2 + 84, 12, '#60a5fa', 'center', 3); }
  }
  function drawMinimap(S) {
    const r = (H < 500 ? 58 : 92) * S, cx = 18 + r + 6, cy = H - 18 - r - 6, scale = P.car ? 0.12 : 0.17, mini = World.minimap(), k = scale / World.MS;
    ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.clip();
    ctx.fillStyle = '#0b3a52'; ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    ctx.save(); ctx.translate(cx, cy); ctx.scale(k, k); ctx.drawImage(mini, -P.x * World.MS, -P.y * World.MS); ctx.restore();
    const blip = (x, y, col, rad, edge) => {
      let dx = (x - P.x) * scale, dy = (y - P.y) * scale; const d = Math.hypot(dx, dy), lim = r - 7;
      if (d > lim) { if (!edge) return; dx = dx / d * lim; dy = dy / d * lim; }
      ctx.fillStyle = col; ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(cx + dx, cy + dy, rad, 0, 7); ctx.fill(); ctx.stroke();
    };
    for (const kk in POI) { const p = POI[kk]; if (kk === 'stash' && !Missions.active) continue; blip(p.x, p.y, p.col, 4.5, false); }
    for (const c of Ents.cars) if (c.driver === 'cop' && !c.wreck) blip(c.x, c.y, Math.floor(T * 5) % 2 ? '#ff2a2a' : '#2a5cff', 4, false);
    for (const p of Ents.peds) if (p.kind === 'cop' && !p.dead) blip(p.x, p.y, '#4f7cff', 2.5, false);
    for (const c of Ents.cars) if (c.driver === 'rival' && !c.wreck) blip(c.x, c.y, '#ff3860', 4, false);
    for (const mk of Missions.markers()) blip(mk.x, mk.y, mk.col, 5.5, true);
    // player arrow
    const ang = P.car ? P.car.a : Math.atan2(P.aim.y, P.aim.x);
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(ang); ctx.fillStyle = '#fff'; ctx.strokeStyle = '#000'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(9, 0); ctx.lineTo(-6, -6); ctx.lineTo(-3, 0); ctx.lineTo(-6, 6); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
    ctx.restore();
    ctx.strokeStyle = '#ff4fd8'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.stroke();
    ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, cy, r + 3, 0, 7); ctx.stroke();
  }
  function drawBigMap() {
    ctx.fillStyle = 'rgba(8,2,22,.88)'; ctx.fillRect(0, 0, W, H);
    const size = Math.min(W, H) - 90, mini = World.minimap(), x0 = (W - size) / 2, y0 = (H - size) / 2 + 10, k = size / SIZE;
    ctx.drawImage(mini, x0, y0, size, size); ctx.strokeStyle = '#ff4fd8'; ctx.lineWidth = 3; ctx.strokeRect(x0, y0, size, size);
    for (const kk in POI) { const p = POI[kk]; ctx.fillStyle = p.col; ctx.beginPath(); ctx.arc(x0 + p.x * k, y0 + p.y * k, 7, 0, 7); ctx.fill(); txt(p.icon, x0 + p.x * k, y0 + p.y * k + 4, 10, '#000', 'center'); txt(p.name, x0 + p.x * k, y0 + p.y * k - 11, 10, '#fff', 'center', 3); }
    for (const mk of Missions.markers()) { ctx.fillStyle = mk.col; ctx.beginPath(); ctx.arc(x0 + mk.x * k, y0 + mk.y * k, 8, 0, 7); ctx.fill(); ctx.strokeStyle = '#000'; ctx.lineWidth = 2; ctx.stroke(); }
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x0 + P.x * k, y0 + P.y * k, 6, 0, 7); ctx.fill(); ctx.strokeStyle = '#000'; ctx.stroke();
    txt('CATZ CITY  ·  [TAB] close', W / 2, y0 - 14, 16, '#ff9ad5', 'center', 4);
  }
  function drawDialog(S) {
    const d = Missions.dialog; if (!d) return;
    const bw = Math.min(W - 40, 720 * S), bh = 120 * S, x = W / 2 - bw / 2, y = H - 18 - 62 * S - bh - 10;
    ctx.fillStyle = 'rgba(15,5,35,.92)'; ctx.fillRect(x, y, bw, bh); ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 3; ctx.strokeRect(x, y, bw, bh);
    const spr = Rig.sprites('pimp_daddy', 0), rest = Rig.restCanvas(spr), ps = bh - 20;
    if (d.speaker === 'OG WHISKERS') { ctx.save(); ctx.beginPath(); ctx.arc(x + 10 + ps / 2, y + bh / 2, ps / 2, 0, 7); ctx.clip(); ctx.fillStyle = '#2a1050'; ctx.fillRect(x, y, ps + 20, bh); ctx.drawImage(rest, 190, 0, 190, 190, x + 10, y + 10, ps, ps); ctx.restore(); ctx.strokeStyle = '#ffd23f'; ctx.beginPath(); ctx.arc(x + 10 + ps / 2, y + bh / 2, ps / 2, 0, 7); ctx.stroke(); }
    const tx = x + ps + 28;
    txt(d.speaker, tx, y + 24 * S, 14 * S, '#ffd23f', 'left', 3);
    const full = d.lines[d.i], shown = full.slice(0, Math.floor(d.t * 50)), size = 16 * S, maxw = bw - ps - 48;
    ctx.font = `700 ${size}px "Helvetica Neue", Arial, sans-serif`; ctx.fillStyle = '#fff'; ctx.textAlign = 'left';
    let line = '', ly = y + 50 * S; for (const w of shown.split(' ')) { const t = line ? line + ' ' + w : w; if (ctx.measureText(t).width > maxw) { ctx.fillText(line, tx, ly); line = w; ly += size * 1.3; } else line = t; } ctx.fillText(line, tx, ly);
    if (shown.length >= full.length && Math.floor(T * 2) % 2) txt('[E] ▶', x + bw - 14, y + bh - 10, 12 * S, '#ffd23f', 'right', 3);
  }
  function drawPause() {
    ctx.fillStyle = 'rgba(8,2,22,.82)'; ctx.fillRect(0, 0, W, H);
    txt('PAUSED', W / 2, H * 0.2, 56, '#ff4fd8', 'center', 8);
    const rows = [['W A S D / ARROWS', 'Move · Drive'], ['SHIFT', 'Run'], ['J / CLICK · K · L', 'Jab · Cross · Kick'], ['E', 'Enter / exit car · interact · talk'], ['SPACE', 'Handbrake'], ['H', 'Horn'],
      ['R', 'Change radio station'], ['Q', 'Buy kevlar (at the bodega)'], ['TAB', 'City map'], ['M', 'Mute'], ['P / ESC', 'Resume']];
    rows.forEach((r, i) => { txt(r[0], W / 2 - 14, H * 0.32 + i * 30, 17, '#ffd23f', 'right', 3); txt(r[1], W / 2 + 14, H * 0.32 + i * 30, 17, '#fff', 'left', 3); });
  }
  function drawEnding() {
    ctx.fillStyle = 'rgba(8,2,22,.82)'; ctx.fillRect(0, 0, W, H);
    txt('THE HOOD RESPECTS YOU', W / 2, H * 0.38, Math.min(70, W / 14), '#ffd23f', 'center', 9);
    txt('Campaign complete · Free roam & courier jobs unlocked', W / 2, H * 0.38 + 46, 20, '#fff', 'center', 4);
    txt('TO BE CONTINUED…', W / 2, H * 0.38 + 96, 28, '#ff4fd8', 'center', 5);
    txt('[ENTER] keep hustlin\'', W / 2, H * 0.38 + 150, 18, '#7dd3fc', 'center', 4);
  }

  // ---------- title screen ----------
  const titleP = { x: 0, y: 0, face: 1, hue: 0, scale: 0.05, vx: 0, vy: 0, walkPh: 0, atk: null, dead: false, down: 0, downT: 0, flash: 0, hp: 1, maxhp: 1, kind: 'x', seed: 1 };
  function drawTitle() {
    const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#12062e'); g.addColorStop(0.45, '#7a1a8c'); g.addColorStop(0.7, '#ff2e93'); g.addColorStop(1, '#ff9a3c');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    const hy = H * 0.62;
    // sun
    const sr = Math.min(W, H) * 0.24, sx = W / 2, sy = hy - sr * 0.45;
    const sg = ctx.createLinearGradient(0, sy - sr, 0, sy + sr); sg.addColorStop(0, '#ffe45e'); sg.addColorStop(1, '#ff2e93');
    ctx.save(); ctx.beginPath(); ctx.arc(sx, sy, sr, 0, 7); ctx.clip(); ctx.fillStyle = sg; ctx.fillRect(sx - sr, sy - sr, sr * 2, sr * 2);
    ctx.fillStyle = '#7a1a8c'; for (let i = 0; i < 7; i++) { const yy = sy + sr * 0.05 + i * sr * 0.14; ctx.fillRect(sx - sr, yy + ((T * 6) % (sr * 0.14)) * 0, sr * 2, 2 + i * 1.6); } ctx.restore();
    // skyline
    ctx.fillStyle = '#1a0838'; let x = 0, seed = 7; while (x < W) { seed = (seed * 9301 + 49297) % 233280; const bw = 30 + (seed / 233280) * 50, bh = 40 + ((seed * 7) % 233280) / 233280 * H * 0.2; ctx.fillRect(x, hy - bh, bw, bh); x += bw + 2; }
    // palms
    for (const px of [W * 0.1, W * 0.9, W * 0.2, W * 0.82]) { ctx.strokeStyle = '#12062e'; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(px, hy + 10); ctx.quadraticCurveTo(px + 14, hy - H * 0.14, px + 8, hy - H * 0.26); ctx.stroke(); ctx.fillStyle = '#12062e'; for (let a = 0; a < 7; a++) { const ang = a * 0.9 + Math.sin(T + px) * 0.05; ctx.beginPath(); ctx.moveTo(px + 8, hy - H * 0.26); ctx.quadraticCurveTo(px + 8 + Math.cos(ang) * 40, hy - H * 0.26 - 30, px + 8 + Math.cos(ang) * 80, hy - H * 0.26 + Math.sin(ang) * 30 + 10); ctx.quadraticCurveTo(px + 8 + Math.cos(ang) * 40, hy - H * 0.26 - 10, px + 8, hy - H * 0.26 + 4); ctx.fill(); } }
    // grid floor
    ctx.fillStyle = '#12062e'; ctx.fillRect(0, hy, W, H - hy); ctx.strokeStyle = '#ff4fd8'; ctx.lineWidth = 1.5;
    for (let i = -20; i <= 20; i++) { ctx.beginPath(); ctx.moveTo(W / 2 + i * 12, hy); ctx.lineTo(W / 2 + i * W * 0.09, H); ctx.stroke(); }
    for (let i = 0; i < 14; i++) { const t = ((i + (T * 0.5) % 1) / 14), yy = hy + Math.pow(t, 2.2) * (H - hy); ctx.beginPath(); ctx.moveTo(0, yy); ctx.lineTo(W, yy); ctx.stroke(); }
    // title
    const ts = Math.min(W / 11, 96);
    ctx.save(); ctx.textAlign = 'center'; ctx.font = `italic 900 ${ts}px "Arial Black", Impact, sans-serif`; ctx.shadowColor = '#ff4fd8'; ctx.shadowBlur = 30;
    const tg = ctx.createLinearGradient(0, H * 0.1, 0, H * 0.1 + ts); tg.addColorStop(0, '#ffe45e'); tg.addColorStop(0.5, '#ff7ac8'); tg.addColorStop(1, '#8a5cff');
    ctx.lineWidth = 10; ctx.strokeStyle = '#12062e'; ctx.strokeText('GRAND THEFT CATZ', W / 2, H * 0.1 + ts); ctx.fillStyle = tg; ctx.fillText('GRAND THEFT CATZ', W / 2, H * 0.1 + ts); ctx.restore();
    txt('STREET HUSTLER EDITION', W / 2, H * 0.1 + ts + 34, Math.min(26, W / 28), '#7dd3fc', 'center', 5);
    // cats
    const cw = Math.min(W / 3.2, 300), baseY = H * 0.88;
    CATS.forEach((c, i) => {
      const cx = W / 2 + (i - 1) * cw, on = i === sel;
      titleP.x = cx; titleP.y = baseY - (on ? 10 + Math.sin(T * 4) * 3 : 0); titleP.char = c.id; titleP.hue = 0; titleP.scale = on ? H * 0.00022 : H * 0.00017;
      if (!on) ctx.globalAlpha = 0.55; else { ctx.fillStyle = 'rgba(255,79,216,.28)'; ctx.beginPath(); ctx.ellipse(cx, baseY + 4, 70, 14, 0, 0, 7); ctx.fill(); }
      Ents.drawPed(ctx, titleP, frame, T); ctx.globalAlpha = 1;
      txt(c.name, cx, baseY + 28, on ? 20 : 15, on ? '#ffd23f' : '#c4b5fd', 'center', 5);
    });
    txt(CATS[sel].tag, W / 2, baseY + 52, 14, '#fff', 'center', 4);
    if (Math.floor(T * 2) % 2) txt(touchMode ? (saved ? 'TAP TO CONTINUE' : 'TAP TO HUSTLE') : (saved ? 'ENTER: NEW GAME    ·    C: CONTINUE' : 'PRESS ENTER TO HUSTLE'), W / 2, H * 0.1 + ts + 78, 20, '#fff', 'center', 5);
    txt(touchMode ? 'tap a cat to choose' : '◀ ▶ choose your cat', W / 2, H * 0.1 + ts + 104, 14, '#c4b5fd', 'center', 4);
    if (saved) { ctx.fillStyle = 'rgba(20,8,40,.6)'; ctx.fillRect(W - 168, H - 58, 150, 38); ctx.strokeStyle = '#ff4fd8'; ctx.lineWidth = 2; ctx.strokeRect(W - 168, H - 58, 150, 38); txt('NEW GAME', W - 93, H - 33, 15, '#ff9ad5', 'center', 3); }
  }

  // ---------- main loop ----------
  function titleInput() {
    if (hit('ArrowLeft', 'KeyA')) { sel = (sel + 2) % 3; }
    if (hit('ArrowRight', 'KeyD')) { sel = (sel + 1) % 3; }
    if (hit('Enter', 'Space')) { Snd.init(); newGame(false); }
    if (hit('KeyC') && saved) { Snd.init(); newGame(true); }
  }
  let slow = 0, fpsN = 0;
  function tick(ts) {
    const dt = Math.min(0.05, (ts - last) / 1000 || 0); last = ts; frame++;
    if (mode === 'play' && !paused) { fpsN++; if (dt > 0.026) slow++; if (fpsN >= 90) { if (slow > 60 && DPR > 1) { DPR = 1; cvs.width = Math.round(W); cvs.height = Math.round(H); } fpsN = slow = 0; } }
    if (mode === 'title') { T += dt; titleInput(); }
    else if (mode === 'play') {
      if (hit('KeyP', 'Escape') && !ending) paused = !paused;
      if (hit('Tab')) showMap = !showMap;
      if (hit('KeyM')) { const m = Snd.mute(); G.notify(m ? 'Sound off' : 'Sound on', '#fff'); }
      if (ending && hit('Enter', 'Space')) ending = false;
      if (!paused && !showMap && !ending) update(dt);
      else T += dt;
    }
    for (const k in pressed) pressed[k] = false;
    try { render(); } catch (e) { console.error(e); }
    requestAnimationFrame(tick);
  }

  // expose a small debug hook for testing
  window.__catz = { get P() { return P; }, G, Ents, Missions, World, start: c => { sel = c || 0; newGame(false); }, cam, keys };

  // boot: load the rigged characters then show the title
  saved = loadSave();
  Rig.load().then(() => {
    for (const c of CATS) { Rig.sprites(c.id, 0); }
    for (const id of ['prison', 'crimson_paw', 'pimp_daddy']) for (const h of [0, 40, 80, 120, 160, 200, 240, 280, 320, -85, 150]) Rig.sprites(id, h);
    mode = 'title'; World.minimap();
  }).catch(e => { console.error(e); mode = 'title'; });
  requestAnimationFrame(tick);
})();
