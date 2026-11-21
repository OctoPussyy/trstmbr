// Grand Theft Catz: Street Hustler. Third-person main loop: input, player, camera, shops, talking, phone, shooting, HUD.
const G = {
  player: null, stars: 0, heat: 0, unseen: 0, cash: 0, rep: 0, hour: 18.9, inside: null,
  shake() {}, crime() {}, addCash() {}, addRep() {}, setWanted() {}, hurtPlayer() {}, onCarExplode() {}, onPedDown() {}, showEnding() {}, save() {}, notify() {}, copShot() {},
};

(() => {
  const POI = World.POI, K = Gfx.K, SIZE = World.SIZE;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), rnd = (a, b) => a + Math.random() * (b - a), pick = a => a[Math.floor(Math.random() * a.length)];
  const glc = document.getElementById('gl'), hudc = document.getElementById('hud'), ctx = hudc.getContext('2d');
  let W = 0, H = 0, DPR = 1;
  function resize() {
    DPR = Math.min(2, window.devicePixelRatio || 1); W = glc.clientWidth || innerWidth; H = glc.clientHeight || innerHeight;
    hudc.width = Math.round(W * DPR); hudc.height = Math.round(H * DPR); Gfx.resize(W, H);
  }

  // ---------------------------------------------------------------- input
  const keys = {}, pressed = {};
  const GAMEKEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab', 'KeyE', 'KeyJ', 'KeyK', 'KeyL', 'KeyR', 'KeyH', 'KeyQ', 'KeyT', 'KeyF', 'KeyG', 'Enter', 'ShiftLeft', 'ShiftRight', 'ControlLeft']);
  let touchMode = false, locked = false;
  addEventListener('keydown', e => { Snd.init(); if (GAMEKEYS.has(e.code) || /^Digit[1-9]$/.test(e.code)) e.preventDefault(); if (!keys[e.code]) pressed[e.code] = true; keys[e.code] = true; });
  addEventListener('keyup', e => { keys[e.code] = false; });
  addEventListener('blur', () => { for (const k in keys) keys[k] = false; if (mode === 'play' && !G.inside) paused = true; });
  const down = (...c) => c.some(k => keys[k]), hit = (...c) => c.some(k => pressed[k]);
  const stick = { id: null, ox: 0, oy: 0, x: 0, y: 0, mx: 0, my: 0 }, look = { id: null, x: 0, y: 0 }, held = new Map();
  const uiHits = [];
  document.addEventListener('pointerlockchange', () => { locked = document.pointerLockElement === glc; });
  function wantLock() { return mode === 'play' && !paused && !showMap && !Missions.dialog && !shop && !ending && !touchMode; }
  function doLook(dx, dy) {
    if (P && P.car) camOff.yaw = clamp(camOff.yaw + dx, -2.8, 2.8); else cam.yaw += dx;
    cam.pitch = clamp(cam.pitch + dy, -0.12, 0.85); camOff.t = 2;
  }
  glc.addEventListener('mousemove', e => { if (mode !== 'play') return; if (locked) doLook(e.movementX * 0.0028, e.movementY * 0.0022); else if (e.buttons & 1) doLook(e.movementX * 0.005, e.movementY * 0.004); });
  glc.addEventListener('contextmenu', e => e.preventDefault());
  function uiClick(x, y) { for (let i = uiHits.length - 1; i >= 0; i--) { const h = uiHits[i]; if (x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h) { h.cb(); return true; } } return false; }
  function btns() {
    const S = clamp(H / 760, 0.8, 1.3), r = 31 * S, car = !!(P && P.car), b = [];
    b.push({ k: 'KeyE', x: W - 72 * S, y: H - 82 * S, r: 36 * S, l: 'ACT' });
    if (!car) {
      b.push({ k: 'KeyJ', x: W - 160 * S, y: H - 64 * S, r, l: P && P.weapon === 'pistol' ? 'FIRE' : 'PUNCH', fire: true }, { k: 'KeyL', x: W - 66 * S, y: H - 172 * S, r: r * 0.85, l: 'KICK' });
      b.push({ k: 'KeyG', x: W - 154 * S, y: H - 150 * S, r: r * 0.75, l: P && P.hasGun ? (P.weapon === 'pistol' ? 'FISTS' : 'GUN') : '' }, { k: 'ShiftLeft', x: W - 252 * S, y: H - 70 * S, r: r * 0.75, l: 'RUN' });
    } else b.push({ k: 'Space', x: W - 160 * S, y: H - 64 * S, r, l: 'DRIFT' }, { k: 'KeyH', x: W - 66 * S, y: H - 172 * S, r: r * 0.8, l: 'HORN' }, { k: 'KeyR', x: W - 154 * S, y: H - 150 * S, r: r * 0.8, l: 'RADIO' });
    b.push({ k: 'KeyP', x: 34, y: 34, r: 20, l: 'II' }, { k: 'Tab', x: 84, y: 34, r: 20, l: 'MAP' });
    if (phone.ringing || (!Missions.active && !G.inside)) b.push({ k: 'KeyT', x: 134, y: 34, r: 20, l: phone.ringing ? 'ANSWER' : 'CALL', ring: phone.ringing });
    return b.filter(x => x.l);
  }
  function applyStick() {
    let dx = stick.x - stick.ox, dy = stick.y - stick.oy; const d = Math.hypot(dx, dy), lim = 58;
    if (d > lim) { stick.ox += dx / d * (d - lim); stick.oy += dy / d * (d - lim); dx = stick.x - stick.ox; dy = stick.y - stick.oy; }
    stick.mx = dx / lim; stick.my = dy / lim;
  }
  function releaseStick() { stick.id = null; stick.mx = stick.my = 0; }
  function startGame(cont) { Snd.init(); newGame(cont && !!saved); }
  function titleTap(p) {
    const cw = Math.min(W / 3.2, 300);
    if (saved && p.x > W - 170 && p.y > H - 64) { startGame(false); return; }
    const idx = p.y > H * 0.5 ? Math.round((p.x - W / 2) / cw) + 1 : -1;
    if (idx >= 0 && idx < 3 && idx !== sel) { sel = idx; return; }
    startGame(true);
  }
  glc.addEventListener('pointerdown', e => {
    Snd.init();
    const r = glc.getBoundingClientRect(), p = { x: e.clientX - r.left, y: e.clientY - r.top };
    if (e.pointerType !== 'mouse') touchMode = true;
    if (mode === 'title') { titleTap(p); return; }
    if (mode !== 'play') return;
    if (uiClick(p.x, p.y)) return;
    if (e.pointerType === 'mouse') {
      if (e.button === 0) { pressed.Mouse0 = true; keys.Mouse0 = true; }
      if (e.button === 2) { keys.Mouse2 = true; }
      if (wantLock() && !locked) { try { glc.requestPointerLock(); } catch (x) { /* ignore */ } }
      return;
    }
    e.preventDefault(); try { glc.setPointerCapture(e.pointerId); } catch (x) { /* ignore */ }
    if (paused) { paused = false; return; } if (showMap) { showMap = false; return; } if (ending) { ending = false; return; }
    if (Missions.dialog) { pressed.KeyE = true; return; }
    for (const b of btns()) if (Math.hypot(p.x - b.x, p.y - b.y) < b.r + 12) { held.set(e.pointerId, b.k); keys[b.k] = true; pressed[b.k] = true; return; }
    if (stick.id === null && p.x < W * 0.45) { stick.id = e.pointerId; stick.ox = stick.x = p.x; stick.oy = stick.y = p.y; stick.mx = stick.my = 0; return; }
    if (look.id === null) { look.id = e.pointerId; look.x = p.x; look.y = p.y; }
  });
  glc.addEventListener('pointermove', e => {
    const r = glc.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    if (e.pointerId === stick.id) { stick.x = x; stick.y = y; applyStick(); }
    else if (e.pointerId === look.id) { doLook((x - look.x) * 0.0062, (y - look.y) * 0.0048); look.x = x; look.y = y; }
  });
  const pend = e => {
    if (e.pointerType === 'mouse') { if (e.button === 0) keys.Mouse0 = false; if (e.button === 2) keys.Mouse2 = false; return; }
    if (held.has(e.pointerId)) { keys[held.get(e.pointerId)] = false; held.delete(e.pointerId); }
    if (e.pointerId === stick.id) releaseStick(); if (e.pointerId === look.id) look.id = null;
  };
  glc.addEventListener('pointerup', pend); glc.addEventListener('pointercancel', pend);

  // ---------------------------------------------------------------- state
  const CATS = [
    { id: 'prison', name: 'PRISON', tag: 'Ink. Knife. Zero chill.', hue: 0 },
    { id: 'crimson_paw', name: 'CRIMSON PAW', tag: 'Loud jacket. Louder mouth.', hue: 0 },
    { id: 'pimp_daddy', name: 'PIMP DADDY', tag: 'Purple suede. Gold chain.', hue: 0 },
  ];
  const PLAYER_HP = 200;
  let mode = 'loading', sel = 0, T = 0, frame = 0, paused = false, showMap = false, last = 0, shakeT = 0, shakeA = 0, ending = false, deadMsg = '', loadMsg = 'LOADING CATZ…';
  let P = null, notes = [], radioFlash = 0, radioName = '', saved = null, popT = 0, copT = 0, zone = '', zoneT = 0, sprayCd = 0, prompt = '', hitStop = 0, themeT = 0, shop = null, fade = { a: 0, to: 0, cb: null }, ambientT = 0;
  const cam = { x: 0, y: 0, yaw: -Math.PI / 2, pitch: 0.3, fov: 62, dist: 5.4, px: 0, py: 0, pz: 0 }, camOff = { yaw: 0, t: 0 };
  const phone = { ringing: false, ringT: 0, next: 50, beep: 0 };
  G.hour = 18.9; G.inside = null;
  const tint = new THREE.Color(1, 1, 1);

  function loadSave() { try { const s = JSON.parse(localStorage.getItem('gtc3_save') || 'null'); return s && typeof s.cash === 'number' ? s : null; } catch (e) { return null; } }
  G.save = () => { try { localStorage.setItem('gtc3_save', JSON.stringify({ cash: G.cash, rep: G.rep, idx: Missions.idx, endless: Missions.endless, hue: P.hue, char: P.char, hour: G.hour, gun: P.hasGun, reserve: P.reserve })); } catch (e) { /* ignore */ } };
  G.notify = (t, col) => { notes.push({ t, col: col || '#fff', life: 4.5 }); if (notes.length > 4) notes.shift(); };
  G.shake = a => { shakeA = Math.max(shakeA, a * 0.5); shakeT = 0.3; };
  G.addCash = a => { G.cash += a; };
  G.addRep = a => { G.rep += a; };
  G.showEnding = () => { ending = true; };

  // ---------------------------------------------------------------- wanted level
  const STAR_AT = [1.2, 4, 8, 13, 19];
  const starsFor = h => STAR_AT.filter(t => h >= t).length;
  G.crime = (amt, x, y) => {
    let seen = false;
    for (const c of Ents.cars) if (c.driver === 'cop' && Math.hypot(c.x - x, c.y - y) < 700) { seen = true; break; }
    if (!seen) for (const p of Ents.peds) if (!p.dead && (p.kind === 'cop' || p.kind === 'civ') && Math.hypot(p.x - x, p.y - y) < (p.kind === 'cop' ? 700 : 340)) { seen = true; break; }
    G.heat = Math.min(22, G.heat + (seen ? amt : amt * 0.2)); G.unseen = 0;
    const s = starsFor(G.heat); if (s > G.stars) { G.stars = s; Snd.play('blip'); }
  };
  G.setWanted = n => { G.heat = Math.max(G.heat, STAR_AT[n - 1]); G.stars = starsFor(G.heat); G.unseen = 0; };
  function clearWanted() { G.heat = 0; G.stars = 0; G.unseen = 0; }

  G.hurtPlayer = (d, sx, sy) => {
    if (!P || P.dead || mode !== 'play' || G.inside) return;
    if (P.armor > 0) { const a = Math.min(P.armor, d * 0.75); P.armor -= a; d -= a; }
    P.hp -= d; P.flash = 0.18; P.regenT = 7; Snd.play('hit'); G.shake(5);
    if (!P.car) { const dx = P.x - sx, dy = P.y - sy, l = Math.hypot(dx, dy) || 1; P.vx += dx / l * 70; P.vy += dy / l * 70; }
    if (P.hp <= 0) die('WASTED');
  };
  G.copShot = c => {
    Gfx.tracer(c.x, c.y, P.x, P.y, 1.5); Snd.play('shotFar');
    const tgt = P.car ? P.car : P, hitP = Math.random() < (P.car ? 0.25 : 0.32);
    if (hitP) G.hurtPlayer(P.car ? 1 : 4, c.x, c.y); else Ents.sparks(tgt.x + rnd(-40, 40), tgt.y + rnd(-40, 40), 3);
    if (P.car) Ents.damageCar(P.car, 12, null);
  };
  G.onCarExplode = c => {
    if (c.driver === 'player') G.hurtPlayer(999, c.x, c.y);
    else if (P && !P.dead && !P.car && Math.hypot(P.x - c.x, P.y - c.y) < 110) G.hurtPlayer(40, c.x, c.y);
    if (c.burnBy === 'player') G.crime(c.driver === 'cop' ? 4 : 1.2, c.x, c.y);
  };
  G.onPedDown = (p, src) => { if (src === 'player') { G.crime(p.kind === 'cop' ? 5 : p.kind === 'civ' ? 2 : 0.3, p.x, p.y); Ents.witnessPanic(p.x, p.y, 420); } };

  function die(kind) {
    if (P.dead) return;
    P.dead = true; P.deadT = 0; P.down = 1e9; P.downT = 0; P.atk = null; deadMsg = kind; shop = null; Missions.reset();
    if (P.car) { P.car.driver = null; P.car = null; }
    P.hidden = false; P.aiming = false;
    Snd.play(kind === 'BUSTED' ? 'busted' : 'wasted'); Snd.engine(0, 0, false); Snd.siren(0); Snd.skid(0);
    Missions.onDown(kind === 'BUSTED' ? 'You got busted' : 'You got wasted');
  }
  function respawn() {
    const busted = deadMsg === 'BUSTED', at = busted ? POI.jail : POI.home;
    G.cash = Math.max(0, G.cash - Math.round(G.cash * (busted ? 0.08 : 0.05)));
    P.hp = PLAYER_HP; P.armor = 0; P.dead = false; P.down = 0; P.hidden = false; P.x = at.x; P.y = at.y + 40; P.vx = P.vy = 0; P.bust = 0;
    clearWanted(); cam.yaw = -Math.PI / 2;
    for (let i = Ents.peds.length - 1; i >= 0; i--) if (Ents.peds[i].kind === 'cop' || Ents.peds[i].kind === 'rival') Ents.peds.splice(i, 1);
    for (let i = Ents.cars.length - 1; i >= 0; i--) if (Ents.cars[i].driver === 'cop' || Ents.cars[i].driver === 'rival') Ents.cars.splice(i, 1);
    G.notify(busted ? 'Released. Lost 8% of your cash.' : 'Patched up. Lost 5% of your cash.', '#ffd23f');
  }

  // ---------------------------------------------------------------- new game
  function newGame(useSave) {
    Ents.reset(); Missions.reset(); clearWanted(); notes = []; shop = null; Interior.leave(); G.inside = null;
    G.cash = 300; G.rep = 0; G.hour = 18.9; Missions.idx = 0; Missions.endless = false;
    const c = CATS[sel];
    P = { kind: 'player', x: POI.home.x, y: POI.home.y + 40, vx: 0, vy: 0, hx: 0, hy: -1, face: 1, hp: PLAYER_HP, maxhp: PLAYER_HP, armor: 0, car: null, atk: null, walkPh: 0, stam: 1, dead: false, deadT: 0, down: 0, downT: 0, flash: 0,
      char: c.id, hue: c.hue, scale: 0.04, aim: { x: 0, y: -1 }, bust: 0, hidden: false, seed: 3, state: 'idle', talk: false, weapon: 'fists', hasGun: false, clip: 12, reserve: 0, reload: 0, fireCd: 0, firing: 0, aiming: false, aimT: 0, regenT: 0 };
    if (useSave && saved) { G.cash = saved.cash; G.rep = saved.rep; Missions.idx = saved.idx || 0; Missions.endless = !!saved.endless; P.hue = saved.hue || 0; P.char = saved.char || P.char; G.hour = saved.hour || G.hour; P.hasGun = !!saved.gun; P.reserve = saved.reserve || 0; }
    G.player = P; cam.yaw = -Math.PI / 2; cam.pitch = 0.3; camOff.yaw = 0;
    // the OG stands outside the safehouse
    Ents.makePed('civ', POI.og.x, POI.og.y, { keep: true, char: 'pimp_daddy', hue: 0, hp: 9999, scale: 0.04 }); const og = Ents.peds[Ents.peds.length - 1]; og.kind = 'og'; og.still = true; og.label = 'OG WHISKERS'; og.hostile = false; og.og = true;
    for (let i = 0; i < 22; i++) Ents.spawnPed(P.x, P.y, 330);
    for (let i = 0; i < 12; i++) Ents.spawnTraffic(P.x, P.y, 520);
    phone.ringing = false; phone.next = 55; mode = 'play'; paused = false; ending = false; zone = ''; Snd.init(); Snd.radioListen(false);
    Missions.say(['Welcome to Catz City, kitty. This is the hood.', 'WASD to move, mouse to look, SHIFT to run, E to act, J/K/L to throw hands.', 'OG Whiskers is out front. Press E next to him, or wait for his call.'], () => {}, 'THE STREET');
  }

  // ---------------------------------------------------------------- shops, talk, phone
  const RUMORS = ['OG Whiskers pays double when it rains. It never rains here.', 'The cops sit outside the Precinct all day. Don\'t go near there.', 'The Pawn Shop sells heat. Big Tone doesn\'t ask questions.', 'Rival crew hangs down by the Wharf. Watch yourself.',
    'A Pay-n-Spray will wash the heat off your ride. Seventy-five bucks.', 'Sleep at your safehouse to save your game.', 'Lowriders bounce, sedans cruise. Sports cars crash.', 'Cops can\'t see you if you break line of sight. Lose \'em in the alleys.', 'I heard Fresh Fits got a new drop. Purple suede.'];
  function openShop(id) {
    const wings = { label: 'Hot wings', price: 15, desc: '+60 health', run() { P.hp = Math.min(P.maxhp, P.hp + 60); } };
    const defs = {
      bodega: { title: 'BODEGA', tag: 'Cash only, bro.', items: [wings, { label: 'Soda', price: 5, desc: '+25 health', run() { P.hp = Math.min(P.maxhp, P.hp + 25); } }, { label: 'Kevlar vest', price: 120, desc: '+50 armor', run() { P.armor = Math.min(100, P.armor + 50); } }] },
      pawn: { title: 'PAWN SHOP', tag: 'Strictly business.', items: [
        { label: P.hasGun ? 'Pistol (owned)' : 'Pistol', price: 300, desc: 'Press G to draw, click to shoot', can: () => !P.hasGun, run() { P.hasGun = true; P.reserve = 36; P.clip = 12; P.weapon = 'pistol'; G.notify('Pistol equipped. [G] switch, [R] reload', '#ffd23f'); } },
        { label: 'Ammo pack (24)', price: 40, desc: 'Needs a pistol', can: () => P.hasGun, run() { P.reserve += 24; } }] },
      fits: { title: 'FRESH FITS', tag: 'Dress like you mean it.', items: [0, 60, 130, 200, 260, 320].map((h, i) => ({ label: 'Colorway ' + (i + 1), price: 60, desc: 'New look', run() { P.hue = h; } })).concat([{ label: 'Original look', price: 0, desc: 'Back to basics', run() { P.hue = 0; } }]) },
      records: { title: 'RECORD SPOT', tag: 'Crate-digging since 1989.', items: [{ label: 'Mixtape', price: 30, desc: '+10 respect', run() { G.rep += 10; } }, { label: 'Ask about the streets', price: 0, desc: 'Free gossip', keep: true, run() { Missions.say([pick(RUMORS)], () => {}, 'DJ PURRSON'); shop = null; } }] },
      home: { title: 'SAFEHOUSE', tag: 'Home sweet home.', items: [
        { label: 'Sleep until morning', price: 0, desc: 'Heal, save, skip the night', run() { G.hour = 8; P.hp = P.maxhp; G.save(); G.notify('Slept it off. Game saved.', '#4fc3ff'); }, close: true },
        { label: 'Take a nap', price: 0, desc: '+2 hours and a full heal', run() { G.hour = (G.hour + 2) % 24; P.hp = P.maxhp; G.save(); G.notify('Fresh. Game saved.', '#4fc3ff'); }, close: true },
        { label: 'Watch the news', price: 0, desc: 'Free', keep: true, run() { shop = null; Missions.say(['(TV) Breaking: Catz City police are "very concerned" about a street legend nobody can name.', '(TV) In sports, the lowrider league postponed again due to hydraulics.'], () => {}, 'TV'); } },
        { label: 'Call OG for work', price: 0, desc: 'Phone', keep: true, run() { shop = null; if (!Missions.callIn()) G.notify('Finish your current job first.', '#ff6b6b'); } }] },
    };
    const d = defs[id]; if (!d) return; shop = Object.assign({ id, sel: 0 }, d);
    try { document.exitPointerLock(); } catch (e) { /* ignore */ }
  }
  function shopBuy(i) {
    const it = shop.items[i]; if (!it) return;
    if (it.can && !it.can()) { G.notify('You can\'t use that right now.', '#ff6b6b'); return; }
    if (it.price > G.cash) { G.notify('Not enough cash.', '#ff6b6b'); Snd.play('fail'); return; }
    G.cash -= it.price; it.run(); if (it.price) Snd.play('buy');
    if (it.close) shop = null; else if (shop && !it.keep) { /* stay open */ }
  }
  function talkTo(p) {
    if (Missions.dialog || shop) return;
    p.talk = true; const done = () => { p.talk = false; };
    const name = p.label || pick(['STRANGER', 'LOCAL', 'PASSERBY']);
    const greet = pick(['Yo.', 'Sup, cat?', 'You lost?', 'Mind your business, kid.', 'Nice fits.', 'Make it quick, I\'m busy.']);
    Missions.say([greet], done, name, [
      { text: 'What\'s good around here?', cb() { Missions.say([pick(RUMORS)], done, name); } },
      { text: 'Got any work?', cb() {
        if (Missions.active) { Missions.say(['You look busy already.'], done, name); return; }
        if (Math.random() < 0.55) { const def = Missions.favorDef(P); Missions.say(['You look reliable. Run this envelope to the ' + def.where + ' for me.', 'I\'ll pay $' + def.reward2 + ' when it gets there.'], () => { Missions.begin(def); done(); }, name); }
        else Missions.say(['Nah. Ask OG Whiskers, he pays better.'], done, name);
      } },
      { text: P.weapon === 'pistol' ? 'Hand over your wallet. (gun)' : 'Hand over your wallet.', cb() {
        if (P.weapon === 'pistol' && P.hasGun) { const amt = Math.floor(rnd(20, 70)); G.addCash(amt); Snd.play('cash'); G.crime(2, p.x, p.y); p.talk = false; p.state = 'flee'; p.flee = 8; p.thx = P.x; p.thy = P.y; G.notify('Mugged for $' + amt, '#ffd23f'); }
        else { Missions.say(['Ha! You? Get outta here.'], () => { p.talk = false; if (Math.random() < 0.5) { p.hostile = true; p.state = 'fight'; } else { p.state = 'flee'; p.flee = 5; p.thx = P.x; p.thy = P.y; } }, name); G.crime(0.4, p.x, p.y); }
      } },
      { text: 'Never mind.', cb: done },
    ]);
  }
  function pickContext() {
    if (G.inside) {
      const a = Interior.nearest(P.x, P.y); if (!a) return null;
      if (a.kind === 'exit') return { label: 'Leave', run: leaveBuilding };
      if (a.kind === 'shop') return { label: a.label, run: () => openShop(Interior.current.r.shop) };
      if (a.kind === 'npc') return { label: a.label, run: () => openShop(Interior.current.r.shop) };
      if (a.kind === 'bed') return { label: 'Rest', run: () => openShop('home') };
      if (a.kind === 'tv') return { label: 'Watch the news', run: () => Missions.say(['(TV) Breaking: Catz City police are "very concerned" about a street legend nobody can name.'], () => {}, 'TV') };
      if (a.kind === 'phone') return { label: 'Phone', run: () => openShop('home') };
      return null;
    }
    if (P.car || P.dead) return null;
    const cands = [];
    for (const k of ['home', 'bodega', 'fits', 'records', 'pawn']) { const d = Math.hypot(P.x - POI[k].x, P.y - POI[k].y); if (d < 70) cands.push({ d: d * 0.8, label: 'Enter ' + POI[k].name, run: () => enterBuilding(k) }); }
    for (const p of Ents.peds) {
      if (p.dead || p.hidden) continue; const d = Math.hypot(P.x - p.x, P.y - p.y); if (d > 56) continue;
      if (p.og) cands.push({ d: d * 0.7, label: 'Talk to OG Whiskers', run: () => { if (!Missions.startFromOG()) G.notify(Missions.active ? 'Finish your current job first.' : 'Not now.', '#ff6b6b'); } });
      else if (p.kind === 'civ' && p.state !== 'fight') cands.push({ d, label: 'Talk', run: () => talkTo(p) });
    }
    let bc = null, bd = 90; for (const c of Ents.cars) { if (c.wreck || c.burn > 0) continue; const d = Math.hypot(c.x - P.x, c.y - P.y); if (d < bd) { bd = d; bc = c; } }
    if (bc) cands.push({ d: bd * 0.9, label: bc.driver && bc.driver !== 'player' ? 'Carjack' : 'Get in', run: () => enterCar(bc) });
    cands.sort((a, b) => a.d - b.d); return cands[0] || null;
  }
  function enterBuilding(k) {
    startFade(() => {
      shop = null; P.vx = P.vy = 0; P.car = null;
      const s = Interior.enter(k); G.inside = { key: k, outX: P.x, outY: P.y, view: Gfx.billboard(Interior.current.g, P.char, P.hue) }; P.x = s.x; P.y = s.y; cam.yaw = s.yaw; cam.pitch = 0.28; camOff.yaw = 0; Snd.play('bell'); Snd.radioListen(false);
      if (k === 'home') { G.save(); }
    });
  }
  function leaveBuilding() {
    startFade(() => { const o = G.inside; if (o && o.view) o.view.grp.parent && o.view.grp.parent.remove(o.view.grp); Interior.leave(); G.inside = null; shop = null; if (o) { P.x = o.outX; P.y = o.outY + 8; } Snd.play('door'); });
  }
  function startFade(cb) { fade.to = 1; fade.cb = cb; }

  function updatePhone(dt) {
    if (phone.ringing) {
      phone.ringT -= dt; phone.beep -= dt; if (phone.beep <= 0) { Snd.play('ring'); phone.beep = 1.6; }
      if (phone.ringT <= 0) { phone.ringing = false; phone.next = 70; G.notify('Missed a call from OG Whiskers.', '#ff9a9a'); }
      return;
    }
    if (G.inside || P.dead || Missions.active || Missions.dialog || shop) return;
    phone.next -= dt; if (phone.next <= 0) { phone.ringing = true; phone.ringT = 22; phone.beep = 0; G.notify('Phone ringing. Press T to answer.', '#ffd23f'); }
  }
  function usePhone() {
    if (Missions.dialog || shop || P.dead) return;
    if (!Missions.callIn()) { G.notify(Missions.active ? 'Finish your current job first.' : 'Not now.', '#ff6b6b'); return; }
    phone.ringing = false; phone.next = 80; Snd.play('click');
  }

  // ---------------------------------------------------------------- player
  function exitCar() {
    const c = P.car; if (!c) return;
    const f = { x: Math.cos(c.a), y: Math.sin(c.a) }, s = { x: -f.y, y: f.x };
    let best = null;
    for (const sd of [-1, 1, 0]) {
      const px = c.x + s.x * sd * (c.wid / 2 + 26) + (sd === 0 ? f.x * (c.len / 2 + 30) : 0), py = c.y + s.y * sd * (c.wid / 2 + 26) + (sd === 0 ? f.y * (c.len / 2 + 30) : 0);
      const r = World.pushCircle(px, py, 12); if (!r.hit && !World.buildingAt(px, py)) { best = r; break; }
    }
    if (!best) best = World.pushCircle(c.x - s.x * 50, c.y - s.y * 50, 12);
    const sp = Math.abs(c.speedF);
    P.x = best.x; P.y = best.y; P.vx = c.vx * 0.3; P.vy = c.vy * 0.3; c.driver = null; c.thr = 0; c.brake = 0.4; c.steer = 0; c.hand = 1;
    P.car = null; P.hidden = false; Snd.engine(0, 0, false); Snd.skid(0); Snd.radioListen(false); Snd.play('door'); cam.yaw = Math.atan2(c.vy || f.y, c.vx || f.x) * 0 + cam.yaw;
    if (sp > 260) G.hurtPlayer((sp - 220) * 0.08, c.x, c.y);
  }
  function enterCar(c) {
    if (c.driver && c.driver !== 'player') {
      const old = c.driver, f = { x: Math.cos(c.a), y: Math.sin(c.a) }, s = { x: -f.y, y: f.x };
      const q = World.pushCircle(c.x - s.x * (c.wid / 2 + 26), c.y - s.y * (c.wid / 2 + 26), 12);
      const ped = Ents.makePed(old === 'cop' ? 'cop' : old === 'rival' ? 'rival' : 'civ', q.x, q.y);
      if (ped.kind === 'civ') { ped.state = 'flee'; ped.flee = 7; ped.thx = P.x; ped.thy = P.y; ped.down = 0.7; }
      Ents.fx.push({ t: 'txt', x: c.x, y: c.y, text: pick(['HEY!', 'MY RIDE!', 'NOOO!']), life: 1, max: 1, col: '#fff' });
      G.crime(old === 'cop' ? 4 : 1.8, c.x, c.y); Ents.witnessPanic(c.x, c.y, 380);
    }
    c.driver = 'player'; c.mode = 'player'; c.route.length = 0; c.keep = false; P.car = c; P.hidden = true; P.vx = P.vy = 0; P.aiming = false;
    cam.yaw = c.a; camOff.yaw = 0;
    Snd.play('door'); Snd.radioListen(true); radioFlash = 3; radioName = Snd.names[Snd.station];
  }
  function moveInput() {
    let fwd = (down('KeyW') ? 1 : 0) - (down('KeyS') ? 1 : 0), right = (down('KeyD') ? 1 : 0) - (down('KeyA') ? 1 : 0), mag = (fwd || right) ? 1 : 0;
    if (stick.id !== null && (stick.mx || stick.my)) { fwd = -stick.my; right = stick.mx; mag = Math.min(1, Math.hypot(fwd, right)); if (mag < 0.12) mag = 0; }
    if (!P.car) { cam.yaw += ((down('ArrowRight') ? 1 : 0) - (down('ArrowLeft') ? 1 : 0)) * 0; }
    return { fwd, right, mag };
  }
  function pushOut(x, y, r) { return G.inside ? Interior.push(x, y, r) : World.pushCircle(x, y, r); }
  function nearestFoe(maxD, arc) {
    let best = null, bd = maxD;
    for (const p of Ents.peds) {
      if (p.dead || p.hidden || p.og) continue; const dx = p.x - P.x, dy = p.y - P.y, d = Math.hypot(dx, dy); if (d > bd) continue;
      if (d > 30 && (dx * P.hx + dy * P.hy) / d < arc) continue; bd = d; best = p;
    }
    return best;
  }
  function startAttack(m, dmg) {
    const f = nearestFoe(78, 0.25); if (f) { const dx = f.x - P.x, dy = f.y - P.y, d = Math.hypot(dx, dy) || 1; P.hx = dx / d; P.hy = dy / d; }
    P.atk = { m, t: 0, done: false, dmg }; P.aiming = false;
  }
  function playerHit() {
    let any = false; const kd = P.atk.m === 'HP';
    for (const p of Ents.peds) {
      if (p.dead || p.og) continue;
      const dx = p.x - P.x, dy = p.y - P.y, d = Math.hypot(dx, dy);
      if (d < 74 && (d < 28 || (dx * P.hx + dy * P.hy) / d > 0.2)) {
        any = true; Ents.hurtPed(p, P.atk.dmg, dx, dy, 'player');
        if (kd && !p.dead) { p.down = Math.max(p.down, 1.1); p.downT = 0; }
        if (!p.dead) G.crime(p.kind === 'cop' ? 3 : p.kind === 'civ' ? 0.5 : 0.08, p.x, p.y);
        Ents.fx.push({ t: 'txt', x: p.x, y: p.y, text: pick(['POW!', 'BAM!', 'WHAP!', 'SMACK!']), life: 0.55, max: 0.55, col: pick(['#ffd23f', '#ff4fd8', '#3ec8ff']) });
        Ents.sparks(p.x, p.y, 4);
      }
    }
    if (any) { Snd.play('punch'); G.shake(3); hitStop = 0.035; Ents.witnessPanic(P.x, P.y, 280); } else Snd.play('whoosh');
  }
  function shoot() {
    if (P.reload > 0 || P.fireCd > 0) return;
    if (P.clip <= 0) { if (P.reserve > 0) startReload(); else { Snd.play('click'); P.fireCd = 0.4; } return; }
    P.clip--; P.fireCd = 0.28; P.firing = 0.1; P.aiming = true; P.aimT = 1.4;
    let dx = Math.cos(cam.yaw), dy = Math.sin(cam.yaw), best = null, ba = 0.15;
    for (const p of Ents.peds) { if (p.dead || p.hidden || p.og) continue; const vx = p.x - P.x, vy = p.y - P.y, d = Math.hypot(vx, vy); if (d < 40 || d > 760) continue; const ang = Math.acos(clamp((vx * dx + vy * dy) / d, -1, 1)); if (ang < ba) { ba = ang; best = p; } }
    if (best) { const vx = best.x - P.x, vy = best.y - P.y, d = Math.hypot(vx, vy); dx = vx / d; dy = vy / d; }
    P.hx = dx; P.hy = dy;
    const ox = P.x + dx * 20, oy = P.y + dy * 20; let hitT = 780, tp = null, tc = null;
    for (const p of Ents.peds) { if (p.dead || p.hidden || p.og) continue; const rx = p.x - ox, ry = p.y - oy, t = rx * dx + ry * dy; if (t < 0 || t > hitT) continue; if (Math.abs(rx * dy - ry * dx) < 15) { hitT = t; tp = p; tc = null; } }
    for (const c of Ents.cars) { if (c === P.car) continue; const rx = c.x - ox, ry = c.y - oy, t = rx * dx + ry * dy; if (t < 0 || t > hitT + 30) continue; if (Math.abs(rx * dy - ry * dx) < c.wid * 0.55) { hitT = Math.max(0, t - c.len * 0.4); tc = c; tp = null; } }
    for (let s = 14; s < hitT; s += 14) if (World.buildingAt(ox + dx * s, oy + dy * s)) { hitT = s; tp = null; tc = null; break; }
    const ex = ox + dx * hitT, ey = oy + dy * hitT; Gfx.tracer(ox, oy, ex, ey, 1.5);
    Snd.play('shot'); G.shake(3); Ents.witnessPanic(P.x, P.y, 650); G.crime(0.45, P.x, P.y);
    if (tp) { Ents.hurtPed(tp, 32, dx, dy, 'player'); Ents.fx.push({ t: 'txt', x: tp.x, y: tp.y, text: pick(['BANG!', 'POW!']), life: 0.5, max: 0.5, col: '#ff6b6b' }); Ents.sparks(tp.x, tp.y, 4); if (tp.kind === 'cop') G.crime(1.5, tp.x, tp.y); }
    else if (tc) { Ents.damageCar(tc, 45, 'player'); Ents.sparks(ex, ey, 6); if (tc.driver === 'cop') G.crime(1, tc.x, tc.y); }
    else Ents.sparks(ex, ey, 3);
    if (P.clip <= 0 && P.reserve > 0) startReload();
  }
  function startReload() { if (P.reload > 0 || P.reserve <= 0 || P.clip >= 12) return; P.reload = 1.3; Snd.play('click'); G.notify('Reloading…', '#cbd5e1'); }

  function updateFoot(dt) {
    const mi = moveInput();
    const cy = Math.cos(cam.yaw), sy = Math.sin(cam.yaw);
    let mx = cy * mi.fwd + (-sy) * mi.right, my = sy * mi.fwd + cy * mi.right; const ml = Math.hypot(mx, my); if (ml > 0) { mx /= ml; my /= ml; }
    const sprint = (down('ShiftLeft', 'ShiftRight') || (touchMode && mi.mag > 0.95)) && P.stam > 0.05 && mi.mag > 0;
    const walk = down('ControlLeft', 'KeyC') || (touchMode && mi.mag < 0.4);
    P.stam = clamp(P.stam + (sprint ? -0.2 : 0.18) * dt, 0, 1);
    let sp = sprint ? 135 : walk ? 45 : 84; if (P.atk) sp *= 0.3; if (P.down > 0) sp = 0; if (P.aiming && !sprint) sp *= 0.7;
    if (!mi.mag) sp = 0;
    P.vx += (mx * sp - P.vx) * Math.min(1, dt * 9); P.vy += (my * sp - P.vy) * Math.min(1, dt * 9);
    // aiming: face the camera direction
    if (P.aimT > 0) { P.aimT -= dt; if (P.aimT <= 0) P.aiming = false; }
    if (P.down > 0) { P.down -= dt; P.downT += dt; }
    if (P.aiming && P.weapon === 'pistol') { P.hx = cy; P.hy = sy; } else if (ml > 0 && !P.atk) { P.hx = mx; P.hy = my; }
    const r = pushOut(P.x + P.vx * dt, P.y + P.vy * dt, 11); P.x = r.x; P.y = r.y;
    P.walkPh += Math.hypot(P.vx, P.vy) * dt * 0.085;
    if (P.fireCd > 0) P.fireCd -= dt; if (P.firing > 0) P.firing -= dt;
    if (P.reload > 0) { P.reload -= dt; if (P.reload <= 0) { const n = Math.min(12 - P.clip, P.reserve); P.clip += n; P.reserve -= n; } }
    if (P.atk) {
      const mv = Poses.Moves[P.atk.m]; P.atk.t += dt * 60;
      if (!P.atk.done && P.atk.t >= mv.S) { P.atk.done = true; playerHit(); }
      if (P.atk.t >= mv.total) P.atk = null;
    } else if (P.down <= 0) {
      const gunOut = P.weapon === 'pistol' && P.hasGun;
      if (gunOut && (down('Mouse0', 'KeyJ', 'KeyF') || (touchMode && keys.KeyJ))) shoot();
      else if (hit('Mouse0', 'KeyJ')) startAttack('LP', 10);
      else if (hit('KeyK')) startAttack('HP', 18);
      else if (hit('KeyL')) startAttack('LK', 14);
      if (hit('KeyG') && P.hasGun) { P.weapon = P.weapon === 'pistol' ? 'fists' : 'pistol'; Snd.play('click'); G.notify(P.weapon === 'pistol' ? 'Pistol out' : 'Fists up', '#cbd5e1'); if (P.weapon === 'pistol') { P.aiming = true; P.aimT = 2; } }
      if (hit('KeyR') && gunOut) startReload();
    }
    P.regenT -= dt; if (P.regenT <= 0 && P.hp < P.maxhp && !P.dead) P.hp = Math.min(P.maxhp, P.hp + dt * 3);
    if (hit('KeyE')) { const c = pickContext(); if (c) c.run(); }
  }
  function updateCar(dt) {
    const c = P.car;
    let steer = (down('KeyD', 'ArrowRight') ? 1 : 0) - (down('KeyA', 'ArrowLeft') ? 1 : 0), thr = down('KeyW', 'ArrowUp') ? 1 : 0, brk = down('KeyS', 'ArrowDown') ? 1 : 0;
    if (stick.id !== null) { steer = clamp(stick.mx * 1.4, -1, 1); thr = stick.my < -0.2 ? 1 : 0; brk = stick.my > 0.25 ? 1 : 0; }
    c.thr = thr; c.brake = brk; c.steer = steer; c.hand = down('Space') ? 1 : 0;
    if (hit('KeyH')) { Snd.play('horn'); for (const o of Ents.cars) if (o.driver === 'npc' && Math.hypot(o.x - c.x, o.y - c.y) < 300) o.ghost = 0; }
    if (hit('KeyE')) exitCar();
    P.x = c.x; P.y = c.y; P.vx = c.vx; P.vy = c.vy;
    if (hit('KeyR')) { radioName = Snd.nextStation(); radioFlash = 3; }
    P.regenT -= dt; if (P.regenT <= 0 && P.hp < P.maxhp) P.hp = Math.min(P.maxhp, P.hp + dt * 3);
  }

  // ---------------------------------------------------------------- world management
  function manage(dt) {
    const dark = darkness(), vr = 900;
    const wantC = Math.round(15 - dark * 4), wantP = Math.round(30 - dark * 10);
    popT -= dt; if (popT <= 0) {
      popT = 0.15; let nc = 0, np = 0; for (const c of Ents.cars) if (c.driver === 'npc') nc++; for (const p of Ents.peds) if (p.kind === 'civ' && !p.dead) np++;
      if (nc < wantC) Ents.spawnTraffic(P.x, P.y, vr); if (np < wantP) Ents.spawnPed(P.x, P.y, vr);
    }
    if (G.stars > 0) {
      copT -= dt;
      if (copT <= 0) {
        copT = 4.5; let cc = 0, cf = 0; for (const c of Ents.cars) if (c.driver === 'cop' && !c.wreck) cc++; for (const p of Ents.peds) if (p.kind === 'cop' && !p.dead) cf++;
        if (cc < Math.min(4, G.stars)) spawnCopCar(vr);
        if (G.stars >= 2 && cf < Math.min(4, G.stars)) spawnCopFoot(vr);
      }
      let seen = false;
      for (const c of Ents.cars) if (c.driver === 'cop' && !c.wreck) { const d = Math.hypot(c.x - P.x, c.y - P.y); if (d < 300 || (d < 700 && World.los(c.x, c.y, P.x, P.y))) { seen = true; break; } }
      if (!seen) for (const p of Ents.peds) if (p.kind === 'cop' && !p.dead) { const d = Math.hypot(p.x - P.x, p.y - P.y); if (d < 260 || (d < 600 && World.los(p.x, p.y, P.x, P.y))) { seen = true; break; } }
      if (seen) G.unseen = 0; else G.unseen += dt;
      if (G.unseen > 4) { G.heat -= dt * 2.2; if (G.heat < STAR_AT[G.stars - 1] - 0.3) G.stars = Math.max(0, G.stars - 1); if (G.heat <= 0.4) { clearWanted(); G.notify('Wanted level lost.', '#3ef2a0'); } }
    } else {
      G.heat = Math.max(0, G.heat - dt * 0.1);
      for (const p of Ents.peds) if (p.kind === 'cop' && !p.dead) { p.kind = 'civ'; p.state = 'idle'; p.hostile = false; p.t = 1; }
      for (const c of Ents.cars) if (c.driver === 'cop') { c.driver = 'npc'; c.mode = 'traffic'; c.route.length = 0; c.cruise = 150; const d = Math.round(((c.a % 6.2832) + 6.2832) % 6.2832 / (Math.PI / 2)) % 4; c.dir = d; c.node = World.nearestNode(c.x + World.DX[d] * 160, c.y + World.DY[d] * 160); }
    }
    if (!P.dead) {
      let near = false;
      for (const p of Ents.peds) if (p.kind === 'cop' && !p.dead && p.down <= 0 && Math.hypot(p.x - P.x, p.y - P.y) < 50 && (!P.car || Math.abs(P.car.speedF) < 50)) { near = true; break; }
      P.bust = near ? P.bust + dt : Math.max(0, P.bust - dt); if (P.bust > 3) die('BUSTED');
    }
  }
  function spawnCopCar(vr) {
    for (let t = 0; t < 10; t++) {
      const a = Math.random() * 6.28, d = vr * rnd(1.1, 1.5), n = World.nearestNode(P.x + Math.cos(a) * d, P.y + Math.sin(a) * d), x = World.center(n[0]), y = World.center(n[1]);
      if (Math.hypot(x - P.x, y - P.y) < vr) continue; const c = Ents.makeCar('police', x, y, Math.atan2(P.y - y, P.x - x), { driver: 'cop', mode: 'chase' }); c.keep = false; return;
    }
  }
  function spawnCopFoot(vr) { const a = Math.random() * 6.28, q = World.randomSidewalk(P.x + Math.cos(a) * vr, P.y + Math.sin(a) * vr, 100); if (Math.hypot(q.x - P.x, q.y - P.y) < vr * 0.8) return; Ents.makePed('cop', q.x, q.y); }

  // ---------------------------------------------------------------- day / night
  const AMB = [[0, [78, 86, 160]], [5, [92, 98, 168]], [6.5, [255, 195, 175]], [8, [255, 255, 255]], [16.5, [255, 255, 255]], [18, [255, 208, 165]], [19.5, [238, 142, 205]], [21, [118, 108, 190]], [24, [78, 86, 160]]];
  function ambient() { const h = G.hour; for (let i = 1; i < AMB.length; i++) if (h <= AMB[i][0]) { const [h0, a] = AMB[i - 1], [h1, b] = AMB[i], u = (h - h0) / (h1 - h0); return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u]; } return AMB[0][1]; }
  const darkness = () => { const a = ambient(); return 1 - (a[0] + a[1] + a[2]) / 765; };

  // ---------------------------------------------------------------- update
  function update(dt) {
    T += dt; G.hour = (G.hour + dt * 24 / 720) % 24;
    if (fade.a !== fade.to) { fade.a += Math.sign(fade.to - fade.a) * dt * 3.2; if ((fade.to === 1 && fade.a >= 1) || (fade.to === 0 && fade.a <= 0)) { fade.a = fade.to; if (fade.to === 1) { const cb = fade.cb; fade.cb = null; if (cb) cb(); fade.to = 0; } } }
    if (hitStop > 0) { hitStop -= dt; return; }
    if (shakeT > 0) shakeT -= dt; else shakeA = 0;
    for (const n of notes) n.life -= dt; notes = notes.filter(n => n.life > 0);
    if (radioFlash > 0) radioFlash -= dt; if (sprayCd > 0) sprayCd -= dt; if (P.flash > 0) P.flash -= dt;
    // dialog / shop input
    const dlg = Missions.dialog;
    if (dlg) {
      if (dlg.choices && dlg.i >= dlg.lines.length - 1) { for (let i = 0; i < 4; i++) if (hit('Digit' + (i + 1))) Missions.choose(i); if (hit('KeyE', 'Enter', 'Space') && dlg.choices.length) { /* wait for number */ } }
      else if (hit('KeyE', 'Enter', 'Space', 'Mouse0')) Missions.advance();
      pressed.KeyE = pressed.Enter = pressed.Space = pressed.Mouse0 = false;
    } else if (shop) {
      if (hit('ArrowDown', 'KeyS')) shop.sel = (shop.sel + 1) % shop.items.length; if (hit('ArrowUp', 'KeyW')) shop.sel = (shop.sel + shop.items.length - 1) % shop.items.length;
      if (hit('KeyE', 'Enter')) shopBuy(shop.sel); for (let i = 0; i < 9; i++) if (hit('Digit' + (i + 1))) shopBuy(i);
      if (hit('Escape', 'KeyQ', 'Tab')) shop = null;
      for (const k of ['KeyE', 'Enter', 'KeyW', 'KeyS', 'ArrowUp', 'ArrowDown', 'Mouse0', 'KeyJ', 'Tab', 'KeyQ']) pressed[k] = false;
    }
    if (P.dead) { P.deadT += dt; P.downT += dt; Ents.update(dt, P); if (P.deadT > 3.8) respawn(); return; }
    if (!G.inside) {
      updatePhone(dt);
      if (hit('KeyT')) usePhone();
      if (P.car) updateCar(dt); else updateFoot(dt);
      Ents.update(dt, P);
      if (P.car) { P.x = P.car.x; P.y = P.car.y; if (P.car.wreck) { P.car = null; P.hidden = false; } }
      manage(dt); Missions.update(dt); poiLogic(dt);
      let sirenV = 0; for (const c of Ents.cars) if (c.driver === 'cop' && !c.wreck) sirenV = Math.max(sirenV, 1 - Math.hypot(c.x - P.x, c.y - P.y) / 900);
      Snd.siren(sirenV); Snd.amb(P.car ? 0 : 1);
      if (P.car) { Snd.engine(Math.abs(P.car.speedF), P.car.thr, true); Snd.skid(P.car.slip > 120 && Math.abs(P.car.speedF) > 50 ? clamp((P.car.slip - 100) / 250, 0, 1) : 0); } else { Snd.engine(0, 0, false); Snd.skid(0); }
      const zn = World.districtAt(P.x, P.y); if (zn !== zone) { zone = zn; zoneT = 3.5; } if (zoneT > 0) zoneT -= dt;
    } else {
      updateFoot(dt); Snd.siren(0); Snd.engine(0, 0, false); Snd.skid(0); Snd.amb(0);
      Missions.update(dt);
    }
    const c0 = pickContext(); prompt = c0 && !shop && !Missions.dialog ? '[E] ' + c0.label : '';
    updateCamera(dt);
  }
  function poiLogic() {
    if (!P.car) return; const d = Math.hypot(P.x - POI.spray.x, P.y - POI.spray.y);
    if (d < 100 && sprayCd <= 0 && Math.abs(P.car.speedF) < 120) {
      if (G.cash < 75) { G.notify('Pay-n-Spray costs $75.', '#ff6b6b'); sprayCd = 5; return; }
      let cop = false; for (const c of Ents.cars) if (c.driver === 'cop' && Math.hypot(c.x - P.x, c.y - P.y) < 300) cop = true;
      if (cop && G.stars) { G.notify('Cops are too close for a respray!', '#ff6b6b'); sprayCd = 4; }
      else if (G.stars || P.car.hp < P.car.maxhp * 0.98) { G.cash -= 75; P.car.hp = P.car.maxhp; if (G.stars) { clearWanted(); G.notify('Fresh paint. Wanted level cleared!', '#3ef2a0'); } else G.notify('Car repaired. $75', '#3ef2a0'); Snd.play('buy'); sprayCd = 8; }
    }
  }

  // ---------------------------------------------------------------- camera
  function updateCamera(dt) {
    const car = P.car; let dist, hMul = 1, tgtH = 1.5;
    if (car) {
      const spd = Math.hypot(car.vx, car.vy);
      if (camOff.t > 0) camOff.t -= dt; else camOff.yaw *= Math.max(0, 1 - dt * 2.5);
      const want = (Math.abs(car.speedF) > 15 ? (car.speedF >= 0 ? car.a : car.a) : cam.yaw - camOff.yaw) + camOff.yaw;
      let d = want - cam.yaw; while (d > Math.PI) d -= 6.2832; while (d < -Math.PI) d += 6.2832; cam.yaw += d * Math.min(1, dt * 3.2);
      dist = 8.5 + Math.min(3.5, spd / 160); tgtH = 1.4; cam.fov += ((62 + Math.min(18, spd / 24)) - cam.fov) * Math.min(1, dt * 3);
      cam.pitch += (0.2 - cam.pitch) * Math.min(1, dt * 1.5);
    } else { dist = P.aiming && P.weapon === 'pistol' ? 3.6 : 5.2; cam.fov += (60 - cam.fov) * Math.min(1, dt * 3); }
    if (G.inside) dist = 3.8;
    const horiz = Math.cos(cam.pitch) * dist, vert = 1.5 + Math.sin(cam.pitch) * dist;
    const cx = Math.cos(cam.yaw), cy = Math.sin(cam.yaw);
    // pull the camera in when a wall is behind the player
    let hd = horiz / K;
    if (!G.inside) { for (let s = 20; s <= horiz / K; s += 12) { if (World.buildingAt(P.x - cx * s, P.y - cy * s)) { hd = Math.max(26, s - 14); break; } } }

    const f = hd / (horiz / K), cxm = (P.x - cx * hd) * K, czm = (P.y - cy * hd) * K, h = 0.9 + (vert - 0.9) * Math.max(0.35, f);
    let sx = 0, sz = 0; if (shakeT > 0) { sx = rnd(-1, 1) * shakeA * 0.04; sz = rnd(-1, 1) * shakeA * 0.04; }
    const k = Math.min(1, dt * 14);
    cam.px += (cxm - cam.px) * (car ? Math.min(1, dt * 9) : k); cam.pz += (czm - cam.pz) * (car ? Math.min(1, dt * 9) : k); cam.py += (h - cam.py) * Math.min(1, dt * 8);
    if (!cam._init) { cam.px = cxm; cam.pz = czm; cam.py = h; cam._init = true; }
    const lookAhead = car ? 4 : 2.6;
    Gfx.setCamera(cam.px + sx, cam.py + sx, cam.pz + sz, P.x * K + cx * lookAhead, tgtH + (cam.pitch - 0.3) * 1.2, P.y * K + cy * lookAhead, cam.fov);
  }

  // ---------------------------------------------------------------- rendering
  function render() {
    if (mode === 'loading') { drawBackdrop(); txt(loadMsg, W / 2, H / 2, 28, '#ff4fd8', 'center'); return; }
    if (mode === 'title') { drawTitle(); return; }
    ambientT -= 1 / 60; if (ambientT <= 0) { ambientT = 0.15; const a = ambient(); Gfx.setTime(G.hour, a, darkness()); tint.setRGB(Math.min(1.1, a[0] / 255 + 0.12), Math.min(1.1, a[1] / 255 + 0.12), Math.min(1.1, a[2] / 255 + 0.14)); }
    Gfx.update(1 / 60);
    if (G.inside) {
      const wt = new THREE.Color(1, 0.96, 0.9); Interior.animate(T, cam.yaw, wt); const v = G.inside.view;
      if (v) { v.grp.position.set(P.x * K, 0, P.y * K); const rx = -Math.sin(cam.yaw), rz = Math.cos(cam.yaw), d = P.hx * rx + P.hy * rz; if (Math.abs(d) > 0.12) v.fx = d > 0 ? 1 : -1; v.face(Math.atan2(-Math.cos(cam.yaw), -Math.sin(cam.yaw)), v.fx || 1, Gfx.pickFrame(P, T), wt); }
    }
    else {
      Gfx.syncCars(Ents.cars, T);
      const list = Ents.peds.slice(); if (!P.hidden) list.push(P); else { /* in car */ }
      Gfx.syncPeds(list, cam.yaw, T, tint); Gfx.syncFx(Ents.fx); Gfx.setMarkers(Missions.markers(), T);
    }
    Gfx.render();
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.clearRect(0, 0, W, H); uiHits.length = 0;
    drawHUD();
    if (fade.a > 0) { ctx.fillStyle = `rgba(0,0,0,${clamp(fade.a, 0, 1)})`; ctx.fillRect(0, 0, W, H); }
  }

  // ---------------------------------------------------------------- HUD
  function txt(s, x, y, size, col, align, stroke) {
    ctx.font = `900 ${size}px "Arial Black", Impact, "Helvetica Neue", sans-serif`; ctx.textAlign = align || 'left'; ctx.textBaseline = 'alphabetic';
    if (stroke) { ctx.lineWidth = stroke; ctx.strokeStyle = '#150a25'; ctx.lineJoin = 'round'; ctx.strokeText(s, x, y); }
    ctx.fillStyle = col || '#fff'; ctx.fillText(s, x, y);
  }
  function star(x, y, r, col) { ctx.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } ctx.closePath(); ctx.fillStyle = col; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#150a25'; ctx.stroke(); }
  const fmt = n => Math.floor(n).toLocaleString('en-US');
  function clock() { const h = Math.floor(G.hour), m = Math.floor((G.hour % 1) * 60); return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`; }
  function worldLabels() {
    if (G.inside) return;
    const lab = (x, y, s, col, h) => { const p = Gfx.project(x, y, h, W, H); if (!p.vis || p.x < -50 || p.x > W + 50) return; const d = Math.hypot(x - P.x, y - P.y); if (d > 2200 || (d > 90 && !World.los(P.x, P.y, x, y))) return; ctx.globalAlpha = clamp(1.4 - d / 1700, 0, 1); txt(s, p.x, p.y, clamp(15 - d / 260, 9, 15), col, 'center', 4); ctx.globalAlpha = 1; };
    for (const k in POI) { const p = POI[k]; if (k === 'stash' && !Missions.active) continue; if (k === 'og') continue; lab(p.x, p.y, p.name, '#fff', 5.2); }
    for (const m of Missions.markers()) if (m.label) lab(m.x, m.y, m.label, m.col, 7);
    for (const p of Ents.peds) if (p.label && !p.dead) lab(p.x, p.y, p.label, '#ffd23f', 3.4);
    for (const f of Ents.fx) if (f.t === 'txt') { const p = Gfx.project(f.x, f.y, 3 + (1 - f.life / f.max) * 1.5, W, H); if (!p.vis) continue; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(-0.1); ctx.globalAlpha = Math.min(1, f.life / f.max * 2); ctx.font = 'italic 900 26px "Arial Black", Impact, sans-serif'; ctx.textAlign = 'center'; ctx.lineWidth = 6; ctx.strokeStyle = '#1a0a2e'; ctx.strokeText(f.text, 0, 0); ctx.fillStyle = f.col || '#ffd23f'; ctx.fillText(f.text, 0, 0); ctx.restore(); }
  }
  function drawHUD() {
    const S = clamp(H / 760, 0.85, 1.35), m = 16;
    worldLabels();
    // crosshair
    if (!P.car && !P.dead && P.hasGun && P.weapon === 'pistol') { ctx.strokeStyle = P.aiming ? '#ff5a5a' : 'rgba(255,255,255,.75)'; ctx.lineWidth = 2; const r = P.aiming ? 8 : 11; ctx.beginPath(); ctx.arc(W / 2, H * 0.46, r, 0, 7); ctx.moveTo(W / 2 - r - 6, H * 0.46); ctx.lineTo(W / 2 - r + 3, H * 0.46); ctx.moveTo(W / 2 + r - 3, H * 0.46); ctx.lineTo(W / 2 + r + 6, H * 0.46); ctx.stroke(); }
    txt('$' + fmt(G.cash), W - m, m + 34 * S, 34 * S, '#4ade80', 'right', 6);
    const bw = 190 * S, bx = W - m - bw, by = m + 48 * S;
    ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(bx - 3, by - 3, bw + 6, 13 * S + 6); ctx.fillStyle = '#7f1d1d'; ctx.fillRect(bx, by, bw, 13 * S); ctx.fillStyle = '#ef4444'; ctx.fillRect(bx, by, bw * clamp(P.hp / P.maxhp, 0, 1), 13 * S);
    if (P.armor > 0) { ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(bx - 3, by + 18 * S - 3, bw + 6, 8 * S + 6); ctx.fillStyle = '#38bdf8'; ctx.fillRect(bx, by + 18 * S, bw * P.armor / 100, 8 * S); }
    for (let i = 0; i < 5; i++) { const on = i < G.stars, fl = on && G.unseen < 0.1 && Math.floor(T * 4) % 2; star(W - m - 14 * S - (4 - i) * 29 * S, by + 50 * S, 11.5 * S, on ? (fl ? '#fff' : '#ffd23f') : 'rgba(255,255,255,.18)'); }
    txt(clock() + '  ·  RESPECT ' + G.rep, W - m, by + 80 * S, 12 * S, '#e9d5ff', 'right', 3);
    if (P.hasGun && !P.car) txt((P.weapon === 'pistol' ? 'PISTOL ' : 'FISTS · ') + (P.reload > 0 ? 'RELOADING' : P.clip + ' / ' + P.reserve), W - m, by + 98 * S, 12 * S, '#fde68a', 'right', 3);
    drawMinimap(S);
    txt((G.inside ? Interior.current.r.name : zone).toUpperCase(), m + 8, touchMode ? 72 : H - m - 2 * 92 * S - 14, 12 * S, '#ff9ad5', 'left', 4);
    if (radioFlash > 0 && P.car) { ctx.globalAlpha = Math.min(1, radioFlash); txt('♪ ' + radioName, W / 2, 34 * S, 16 * S, '#7dd3fc', 'center', 4); ctx.globalAlpha = 1; }
    // objective
    const ob = Missions.objective(); let line1 = '', line2 = '';
    if (ob) { line1 = ob.title.toUpperCase() + (ob.steps > 1 ? `   ${ob.step}/${ob.steps}` : ''); line2 = ob.text + (ob.time !== null ? `   ⏱ ${Math.ceil(ob.time)}s` : ''); }
    else { line1 = 'FREE ROAM'; line2 = Missions.idx < Missions.total ? 'OG Whiskers has work. Meet him or answer his call [T]' : 'Courier jobs from OG [T], or cause some chaos'; }
    const bwid = touchMode ? Math.min(W - 420, 400) : Math.min(W - 40, 540 * S), oy = touchMode ? m + 2 : H - m - 58 * S, fs = touchMode ? 11 : 14 * S;
    ctx.fillStyle = 'rgba(15,5,35,.72)'; ctx.fillRect(W / 2 - bwid / 2, oy, bwid, 52 * S); ctx.fillStyle = ob ? '#ffd23f' : '#c084fc'; ctx.fillRect(W / 2 - bwid / 2, oy, 5, 52 * S);
    txt(line1, W / 2 - bwid / 2 + 14, oy + 20 * S, 11 * S, ob ? '#ffd23f' : '#c084fc', 'left', 3);
    ctx.font = `900 ${fs}px "Arial Black", Impact, sans-serif`; let l2 = line2; while (ctx.measureText(l2).width > bwid - 24 && l2.length > 8) l2 = l2.slice(0, -2); if (l2 !== line2) l2 += '…';
    txt(l2, W / 2 - bwid / 2 + 14, oy + 41 * S, fs, '#fff', 'left', 3);
    if (prompt && !Missions.dialog && !shop) txt(touchMode ? prompt.replace('[E]', '[ACT]') : prompt, W / 2, H - m - (touchMode ? 20 : 72 * S), 16 * S, '#fff', 'center', 5);
    if (phone.ringing) { const sh = Math.sin(T * 30) * 2, py0 = touchMode ? 124 : 80 * S; ctx.save(); ctx.translate(W / 2 + sh, py0); ctx.fillStyle = 'rgba(20,8,40,.85)'; ctx.fillRect(-150 * S, -26 * S, 300 * S, 52 * S); ctx.strokeStyle = '#3ef2a0'; ctx.lineWidth = 3; ctx.strokeRect(-150 * S, -26 * S, 300 * S, 52 * S); ctx.restore(); txt('☎ OG WHISKERS CALLING', W / 2, py0 - 2 * S, 16 * S, '#3ef2a0', 'center', 4); txt(touchMode ? 'tap ANSWER' : 'press T to answer', W / 2, py0 + 16 * S, 12 * S, '#fff', 'center', 3); }
    let ny = touchMode ? 84 : m + 24; for (const n of notes) { ctx.globalAlpha = Math.min(1, n.life); txt(n.t, touchMode ? W / 2 : m, ny, (touchMode ? 12 : 14) * S, n.col, touchMode ? 'center' : 'left', 4); ctx.globalAlpha = 1; ny += 20 * S; }
    if (shop) drawShop(S); else drawDialog(S);
    const b = Missions.banner; if (b) { const a = Math.min(1, b.t * 1.5); ctx.globalAlpha = a; txt(b.text, W / 2, H * 0.3, Math.min(54 * S, W / 12), b.col, 'center', 9); txt(b.sub, W / 2, H * 0.3 + 34 * S, 20 * S, '#fff', 'center', 5); ctx.globalAlpha = 1; }
    if (P.dead) { const u = clamp(P.deadT / 1.2, 0, 1); ctx.fillStyle = `rgba(0,0,0,${0.55 * u})`; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = u; txt(deadMsg, W / 2, H / 2 + 20, Math.min(120 * S, W / 5), deadMsg === 'BUSTED' ? '#60a5fa' : '#ef4444', 'center', 12); ctx.globalAlpha = 1; }
    if (P.bust > 0.1 && !P.dead) { ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(W / 2 - 90, H / 2 + 70, 180, 10); ctx.fillStyle = '#60a5fa'; ctx.fillRect(W / 2 - 88, H / 2 + 72, 176 * clamp(P.bust / 3, 0, 1), 6); txt('BEING ARRESTED', W / 2, H / 2 + 64, 12, '#60a5fa', 'center', 3); }
    if (showMap) drawBigMap(); if (paused) drawPause(); if (ending) drawEnding(); drawTouch();
  }
  function drawTouch() {
    if (!touchMode || mode !== 'play' || P.dead || ending) return;
    ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    if (stick.id !== null) { ctx.strokeStyle = 'rgba(255,255,255,.45)'; ctx.lineWidth = 3; ctx.fillStyle = 'rgba(255,255,255,.08)'; ctx.beginPath(); ctx.arc(stick.ox, stick.oy, 58, 0, 7); ctx.fill(); ctx.stroke(); ctx.fillStyle = 'rgba(255,79,216,.6)'; ctx.beginPath(); ctx.arc(clamp(stick.x, stick.ox - 58, stick.ox + 58), clamp(stick.y, stick.oy - 58, stick.oy + 58), 25, 0, 7); ctx.fill(); }
    else { ctx.strokeStyle = 'rgba(255,255,255,.2)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(150, H - 120, 48, 0, 7); ctx.stroke(); ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.font = '900 10px Arial'; ctx.fillText('MOVE', 150, H - 120); }
    for (const b of btns()) { const on = keys[b.k]; ctx.fillStyle = on ? 'rgba(255,210,63,.55)' : b.ring ? 'rgba(62,242,160,.4)' : 'rgba(20,8,40,.5)'; ctx.strokeStyle = on ? '#ffd23f' : b.ring ? '#3ef2a0' : 'rgba(255,255,255,.6)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, 7); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#fff'; ctx.font = `900 ${Math.max(9, b.r * 0.36)}px "Arial Black", Arial, sans-serif`; ctx.fillText(b.l, b.x, b.y + 1); }
    ctx.restore();
  }
  function drawMinimap(S) {
    const r = (touchMode ? 46 : 88) * S, cx = 16 + r + 6, cy = touchMode ? 76 + r : H - 16 - r - 6, scale = P.car ? 0.11 : 0.16, mini = World.minimap(), k = scale / World.MS, th = -Math.PI / 2 - cam.yaw;
    ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.clip(); ctx.fillStyle = '#0b3a52'; ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    if (!G.inside) { ctx.save(); ctx.translate(cx, cy); ctx.rotate(th); ctx.scale(k, k); ctx.drawImage(mini, -P.x * World.MS, -P.y * World.MS); ctx.restore(); }
    const blip = (x, y, c, rad, edge) => {
      let dx = (x - P.x) * scale, dy = (y - P.y) * scale; const co = Math.cos(th), si = Math.sin(th); const rx = dx * co - dy * si, ry = dx * si + dy * co, d = Math.hypot(rx, ry), lim = r - 7; dx = rx; dy = ry;
      if (d > lim) { if (!edge) return; dx = rx / d * lim; dy = ry / d * lim; }
      ctx.fillStyle = c; ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(cx + dx, cy + dy, rad, 0, 7); ctx.fill(); ctx.stroke();
    };
    if (!G.inside) {
      for (const kk in POI) { const p = POI[kk]; if (kk === 'stash' && !Missions.active) continue; blip(p.x, p.y, p.col, 4.5, false); }
      for (const c of Ents.cars) if (c.driver === 'cop' && !c.wreck) blip(c.x, c.y, Math.floor(T * 5) % 2 ? '#ff2a2a' : '#2a5cff', 4, false);
      for (const p of Ents.peds) if (p.kind === 'cop' && !p.dead) blip(p.x, p.y, '#4f7cff', 2.5, false);
      for (const c of Ents.cars) if (c.driver === 'rival' && !c.wreck) blip(c.x, c.y, '#ff3860', 4, false);
      for (const mk of Missions.markers()) blip(mk.x, mk.y, mk.col, 5.5, true);
    }
    ctx.save(); ctx.translate(cx, cy); ctx.fillStyle = '#fff'; ctx.strokeStyle = '#000'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, -9); ctx.lineTo(-6, 6); ctx.lineTo(0, 3); ctx.lineTo(6, 6); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore(); ctx.restore();
    ctx.strokeStyle = '#ff4fd8'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.stroke(); txt('N', cx + Math.sin(-th + Math.PI / 2 * 0) * 0, cy - r + 14, 11, '#fff', 'center', 3);
  }
  function drawBigMap() {
    ctx.fillStyle = 'rgba(8,2,22,.9)'; ctx.fillRect(0, 0, W, H);
    const size = Math.min(W, H) - 90, x0 = (W - size) / 2, y0 = (H - size) / 2 + 10, k = size / SIZE; ctx.drawImage(World.minimap(), x0, y0, size, size); ctx.strokeStyle = '#ff4fd8'; ctx.lineWidth = 3; ctx.strokeRect(x0, y0, size, size);
    for (const kk in POI) { const p = POI[kk]; ctx.fillStyle = p.col; ctx.beginPath(); ctx.arc(x0 + p.x * k, y0 + p.y * k, 7, 0, 7); ctx.fill(); txt(p.icon, x0 + p.x * k, y0 + p.y * k + 4, 10, '#000', 'center'); txt(p.name, x0 + p.x * k, y0 + p.y * k - 11, 10, '#fff', 'center', 3); }
    for (const mk of Missions.markers()) { ctx.fillStyle = mk.col; ctx.beginPath(); ctx.arc(x0 + mk.x * k, y0 + mk.y * k, 8, 0, 7); ctx.fill(); ctx.strokeStyle = '#000'; ctx.lineWidth = 2; ctx.stroke(); }
    const px = G.inside ? G.inside.outX : P.x, py = G.inside ? G.inside.outY : P.y; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x0 + px * k, y0 + py * k, 6, 0, 7); ctx.fill(); ctx.strokeStyle = '#000'; ctx.stroke();
    txt('CATZ CITY  ·  [TAB] close', W / 2, y0 - 14, 16, '#ff9ad5', 'center', 4);
  }
  function wrap(s, x, y, maxw, size, lh, col) { ctx.font = `700 ${size}px "Helvetica Neue", Arial, sans-serif`; ctx.fillStyle = col || '#fff'; ctx.textAlign = 'left'; let line = '', ly = y; for (const w of s.split(' ')) { const t = line ? line + ' ' + w : w; if (ctx.measureText(t).width > maxw) { ctx.fillText(line, x, ly); line = w; ly += lh; } else line = t; } ctx.fillText(line, x, ly); return ly; }
  function drawDialog(S) {
    const d = Missions.dialog; if (!d) return;
    const nch = d.choices && d.i >= d.lines.length - 1 ? d.choices.length : 0;
    const bw = Math.min(W - 24, 720 * S), bh = (112 + nch * 30) * S, x = W / 2 - bw / 2, y = H - 14 - 58 * S - bh - 14;
    ctx.fillStyle = 'rgba(15,5,35,.93)'; ctx.fillRect(x, y, bw, bh); ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 3; ctx.strokeRect(x, y, bw, bh);
    const ps = 84 * S, og = /OG WHISKERS/.test(d.speaker), tx = x + (og ? ps + 28 : 18);
    if (og) { const spr = Rig.sprites('pimp_daddy', 0), rest = Rig.restCanvas(spr); ctx.save(); ctx.beginPath(); ctx.arc(x + 10 + ps / 2, y + 10 + ps / 2, ps / 2, 0, 7); ctx.clip(); ctx.fillStyle = '#2a1050'; ctx.fillRect(x, y, ps + 20, ps + 20); ctx.drawImage(rest, 190, 0, 190, 190, x + 10, y + 10, ps, ps); ctx.restore(); ctx.strokeStyle = '#ffd23f'; ctx.beginPath(); ctx.arc(x + 10 + ps / 2, y + 10 + ps / 2, ps / 2, 0, 7); ctx.stroke(); }
    txt(d.speaker, tx, y + 22 * S, 13 * S, '#ffd23f', 'left', 3);
    const full = d.lines[d.i], shown = full.slice(0, Math.floor(d.t * 55)); wrap(shown, tx, y + 46 * S, bw - (tx - x) - 16, 15 * S, 20 * S);
    if (nch) d.choices.forEach((c, i) => {
      const cy2 = y + (96 + i * 30) * S - 8, rect = { x: tx - 6, y: cy2 - 4, w: bw - (tx - x) - 8, h: 26 * S };
      ctx.fillStyle = 'rgba(255,210,63,.14)'; ctx.fillRect(rect.x, rect.y, rect.w, rect.h); txt((i + 1) + '  ' + c.text, tx + 4, cy2 + 15 * S, 13 * S, '#fff', 'left', 3); uiHits.push({ x: rect.x, y: rect.y, w: rect.w, h: rect.h, cb: () => Missions.choose(i) });
    });
    else if (Math.floor(T * 2) % 2) txt(touchMode ? 'tap ▶' : '[E] ▶', x + bw - 12, y + bh - 10, 12 * S, '#ffd23f', 'right', 3);
    if (!nch) uiHits.push({ x, y, w: bw, h: bh, cb: () => Missions.advance() });
  }
  function drawShop(S) {
    const n = shop.items.length, bw = Math.min(W - 24, 520 * S), rowH = 44 * S, bh = 86 * S + n * rowH, x = W / 2 - bw / 2, y = Math.max(10, H / 2 - bh / 2 - 20);
    ctx.fillStyle = 'rgba(15,5,35,.95)'; ctx.fillRect(x, y, bw, bh); ctx.strokeStyle = '#ff4fd8'; ctx.lineWidth = 3; ctx.strokeRect(x, y, bw, bh);
    txt(shop.title, x + 16, y + 30 * S, 20 * S, '#ff9ad5', 'left', 4); txt(shop.tag, x + 16, y + 50 * S, 12 * S, '#c4b5fd', 'left', 3); txt('$' + fmt(G.cash), x + bw - 16, y + 30 * S, 18 * S, '#4ade80', 'right', 4);
    shop.items.forEach((it, i) => {
      const ry = y + 62 * S + i * rowH, on = i === shop.sel, dis = (it.can && !it.can()) || it.price > G.cash;
      ctx.fillStyle = on ? 'rgba(255,79,216,.28)' : 'rgba(255,255,255,.06)'; ctx.fillRect(x + 8, ry, bw - 16, rowH - 4);
      txt((i + 1) + '  ' + it.label, x + 18, ry + 19 * S, 14 * S, dis ? '#8b7aa8' : '#fff', 'left', 3); txt(it.desc, x + 38, ry + 35 * S, 10.5 * S, '#a99bc7', 'left', 2); txt(it.price ? '$' + it.price : 'FREE', x + bw - 18, ry + 24 * S, 14 * S, dis ? '#8b7aa8' : '#ffd23f', 'right', 3);
      uiHits.push({ x: x + 8, y: ry, w: bw - 16, h: rowH - 4, cb: () => { shop.sel = i; shopBuy(i); } });
    });
    const cy = y + bh - 4; const cr = { x: x + bw - 100 * S, y: y - 30 * S, w: 92 * S, h: 24 * S }; ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.fillRect(cr.x, cr.y, cr.w, cr.h); txt(touchMode ? 'CLOSE' : 'ESC', cr.x + cr.w / 2, cr.y + 17 * S, 12 * S, '#fff', 'center', 3); uiHits.push({ x: cr.x, y: cr.y, w: cr.w, h: cr.h, cb: () => { shop = null; } });
  }
  function drawPause() {
    ctx.fillStyle = 'rgba(8,2,22,.85)'; ctx.fillRect(0, 0, W, H); txt('PAUSED', W / 2, H * 0.16, Math.min(52, W / 8), '#ff4fd8', 'center', 8);
    const rows = [['W A S D', 'Move  ·  Drive'], ['MOUSE / ARROWS', 'Look  ·  click to lock the mouse'], ['SHIFT', 'Sprint'], ['J / CLICK', 'Punch  ·  Fire'], ['K  ·  L', 'Cross  ·  Kick'], ['E', 'Act: enter, talk, buy, carjack'], ['G', 'Draw / holster pistol'], ['R', 'Reload  ·  Radio'], ['T', 'Answer / call OG'], ['SPACE', 'Handbrake'], ['TAB', 'Map'], ['M', 'Mute'], ['P / ESC', 'Resume']];
    const rh = Math.min(28, (H * 0.7) / rows.length); rows.forEach((r, i) => { txt(r[0], W / 2 - 12, H * 0.26 + i * rh, rh * 0.62, '#ffd23f', 'right', 3); txt(r[1], W / 2 + 12, H * 0.26 + i * rh, rh * 0.62, '#fff', 'left', 3); });
  }
  function drawEnding() {
    ctx.fillStyle = 'rgba(8,2,22,.85)'; ctx.fillRect(0, 0, W, H); txt('THE HOOD RESPECTS YOU', W / 2, H * 0.38, Math.min(70, W / 14), '#ffd23f', 'center', 9);
    txt('Campaign complete · Courier jobs and favors keep coming', W / 2, H * 0.38 + 46, 18, '#fff', 'center', 4); txt('TO BE CONTINUED…', W / 2, H * 0.38 + 96, 28, '#ff4fd8', 'center', 5); txt(touchMode ? 'tap to keep hustlin\'' : '[ENTER] keep hustlin\'', W / 2, H * 0.38 + 150, 18, '#7dd3fc', 'center', 4);
  }

  // ---------------------------------------------------------------- title
  const titleP = { x: 0, y: 0, face: 1, hue: 0, scale: 0.05, vx: 0, vy: 0, walkPh: 0, atk: null, dead: false, down: 0, downT: 0, flash: 0, hp: 1, maxhp: 1, kind: 'x', seed: 1 };
  function drawBackdrop() { ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.fillStyle = '#0b0614'; ctx.fillRect(0, 0, W, H); }
  function drawTitle() {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.clearRect(0, 0, W, H);
    const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#12062e'); g.addColorStop(0.45, '#7a1a8c'); g.addColorStop(0.7, '#ff2e93'); g.addColorStop(1, '#ff9a3c'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    const hy = H * 0.62, sr = Math.min(W, H) * 0.24, sx = W / 2, sy = hy - sr * 0.45, sg = ctx.createLinearGradient(0, sy - sr, 0, sy + sr); sg.addColorStop(0, '#ffe45e'); sg.addColorStop(1, '#ff2e93');
    ctx.save(); ctx.beginPath(); ctx.arc(sx, sy, sr, 0, 7); ctx.clip(); ctx.fillStyle = sg; ctx.fillRect(sx - sr, sy - sr, sr * 2, sr * 2); ctx.fillStyle = '#7a1a8c'; for (let i = 0; i < 7; i++) ctx.fillRect(sx - sr, sy + sr * 0.05 + i * sr * 0.14, sr * 2, 2 + i * 1.6); ctx.restore();
    ctx.fillStyle = '#1a0838'; let x = 0, seed = 7; while (x < W) { seed = (seed * 9301 + 49297) % 233280; const bw = 30 + (seed / 233280) * 50, bh = 40 + ((seed * 7) % 233280) / 233280 * H * 0.2; ctx.fillRect(x, hy - bh, bw, bh); x += bw + 2; }
    for (const px of [W * 0.1, W * 0.9, W * 0.2, W * 0.82]) { ctx.strokeStyle = '#12062e'; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(px, hy + 10); ctx.quadraticCurveTo(px + 14, hy - H * 0.14, px + 8, hy - H * 0.26); ctx.stroke(); ctx.fillStyle = '#12062e'; for (let a = 0; a < 7; a++) { const ang = a * 0.9 + Math.sin(T + px) * 0.05; ctx.beginPath(); ctx.moveTo(px + 8, hy - H * 0.26); ctx.quadraticCurveTo(px + 8 + Math.cos(ang) * 40, hy - H * 0.26 - 30, px + 8 + Math.cos(ang) * 80, hy - H * 0.26 + Math.sin(ang) * 30 + 10); ctx.quadraticCurveTo(px + 8 + Math.cos(ang) * 40, hy - H * 0.26 - 10, px + 8, hy - H * 0.26 + 4); ctx.fill(); } }
    ctx.fillStyle = '#12062e'; ctx.fillRect(0, hy, W, H - hy); ctx.strokeStyle = '#ff4fd8'; ctx.lineWidth = 1.5;
    for (let i = -20; i <= 20; i++) { ctx.beginPath(); ctx.moveTo(W / 2 + i * 12, hy); ctx.lineTo(W / 2 + i * W * 0.09, H); ctx.stroke(); }
    for (let i = 0; i < 14; i++) { const t = ((i + (T * 0.5) % 1) / 14), yy = hy + Math.pow(t, 2.2) * (H - hy); ctx.beginPath(); ctx.moveTo(0, yy); ctx.lineTo(W, yy); ctx.stroke(); }
    const ts = Math.min(W / 11, 96); ctx.save(); ctx.textAlign = 'center'; ctx.font = `italic 900 ${ts}px "Arial Black", Impact, sans-serif`; ctx.shadowColor = '#ff4fd8'; ctx.shadowBlur = 30;
    const tg = ctx.createLinearGradient(0, H * 0.1, 0, H * 0.1 + ts); tg.addColorStop(0, '#ffe45e'); tg.addColorStop(0.5, '#ff7ac8'); tg.addColorStop(1, '#8a5cff'); ctx.lineWidth = 10; ctx.strokeStyle = '#12062e'; ctx.strokeText('GRAND THEFT CATZ', W / 2, H * 0.1 + ts); ctx.fillStyle = tg; ctx.fillText('GRAND THEFT CATZ', W / 2, H * 0.1 + ts); ctx.restore();
    txt('STREET HUSTLER', W / 2, H * 0.1 + ts + 34, Math.min(26, W / 28), '#7dd3fc', 'center', 5);
    const cw = Math.min(W / 3.2, 300), baseY = H * 0.88;
    CATS.forEach((c, i) => { const cx = W / 2 + (i - 1) * cw, on = i === sel; titleP.x = cx; titleP.y = baseY - (on ? 10 + Math.sin(T * 4) * 3 : 0); titleP.char = c.id; titleP.hue = 0; titleP.scale = on ? H * 0.00022 : H * 0.00017;
      if (!on) ctx.globalAlpha = 0.55; else { ctx.fillStyle = 'rgba(255,79,216,.28)'; ctx.beginPath(); ctx.ellipse(cx, baseY + 4, 70, 14, 0, 0, 7); ctx.fill(); } Ents.drawPed(ctx, titleP, frame, T); ctx.globalAlpha = 1; txt(c.name, cx, baseY + 28, on ? 20 : 15, on ? '#ffd23f' : '#c4b5fd', 'center', 5); });
    txt(CATS[sel].tag, W / 2, baseY + 52, 14, '#fff', 'center', 4);
    if (Math.floor(T * 2) % 2) txt(touchMode ? (saved ? 'TAP TO CONTINUE' : 'TAP TO HUSTLE') : (saved ? 'ENTER: NEW GAME    ·    C: CONTINUE' : 'PRESS ENTER TO HUSTLE'), W / 2, H * 0.1 + ts + 78, 20, '#fff', 'center', 5);
    txt(touchMode ? 'tap a cat to choose' : '◀ ▶ choose your cat', W / 2, H * 0.1 + ts + 104, 14, '#c4b5fd', 'center', 4);
    if (saved) { ctx.fillStyle = 'rgba(20,8,40,.6)'; ctx.fillRect(W - 168, H - 58, 150, 38); ctx.strokeStyle = '#ff4fd8'; ctx.lineWidth = 2; ctx.strokeRect(W - 168, H - 58, 150, 38); txt('NEW GAME', W - 93, H - 33, 15, '#ff9ad5', 'center', 3); }
  }

  // ---------------------------------------------------------------- loop
  let slow = 0, fpsN = 0;
  function tick(ts) {
    const dt = Math.min(0.05, (ts - last) / 1000 || 0); last = ts; frame++;
    if (mode === 'title') { T += dt; if (hit('ArrowLeft', 'KeyA')) sel = (sel + 2) % 3; if (hit('ArrowRight', 'KeyD')) sel = (sel + 1) % 3; if (hit('Enter', 'Space')) startGame(false); if (hit('KeyC') && saved) startGame(true); }
    else if (mode === 'play') {
      if (hit('KeyP', 'Escape') && !ending && !shop && !Missions.dialog) { paused = !paused; if (paused) { try { document.exitPointerLock(); } catch (e) { /* ignore */ } } }
      if (hit('Tab') && !shop) showMap = !showMap;
      if (hit('KeyM')) { const mm = Snd.mute(); G.notify(mm ? 'Sound off' : 'Sound on', '#fff'); }
      if (ending && hit('Enter', 'Space')) ending = false;
      if (!paused && !showMap && !ending) { update(dt); fpsN++; if (dt > 0.03) slow++; if (fpsN >= 90) { if (slow > 55) { Gfx.renderer.setPixelRatio(Math.max(0.75, Gfx.renderer.getPixelRatio() - 0.25)); } fpsN = slow = 0; } } else T += dt;
      if (!wantLock() && locked) { try { document.exitPointerLock(); } catch (e) { /* ignore */ } }
    }
    for (const k in pressed) pressed[k] = false;
    try { render(); } catch (e) { console.error(e); }
    requestAnimationFrame(tick);
  }
  window.__catz = { get P() { return P; }, G, Ents, Missions, World, Gfx, Interior, cam, keys, start: c => { sel = c || 0; newGame(false); }, enter: k => enterBuilding(k), openShop, talkTo, get shop() { return shop; }, phone, usePhone, shoot, enterCar, get fade() { return fade; } };

  saved = loadSave();
  try { Gfx.init(glc); } catch (e) { console.error('GL init failed', e); loadMsg = 'Your browser could not start 3D graphics.'; }
  resize(); addEventListener('resize', resize);
  Rig.load().then(() => {
    loadMsg = 'BUILDING THE HOOD…';
    for (const id of ['prison', 'crimson_paw', 'pimp_daddy']) for (const h of [0, 40, 80, 120, 160, 200, 240, 280, 320, 150, -85]) Rig.sprites(id, h);
    for (const id of ['prison', 'crimson_paw', 'pimp_daddy']) for (const h of [0, 40, 80, 120, 160, 200, 240, 280, 320, 150, -85]) Gfx.spriteSet(id, h);
    mode = 'title'; World.minimap();
  }).catch(e => { console.error(e); mode = 'title'; });
  requestAnimationFrame(tick);
})();
