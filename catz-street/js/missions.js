// The hustle: a short campaign from OG Whiskers, then endless courier jobs.
const Missions = (() => {
  const POI = World.POI, E = World.edgePoint;
  let idx = 0, active = null, dialog = null, endless = false, banner = null;
  const OG = 'OG WHISKERS';
  const near = (a, b, r) => Math.hypot(a.x - b.x, a.y - b.y) < r;
  const rnd = (a, b) => a + Math.random() * (b - a);

  // ---------- step factories ----------
  function goto(pos, text, o) {
    o = o || {};
    return { text, r: o.r || 70, car: !!o.car, time: o.time ? Math.round(o.time * 1.5) : o.time, label: o.label, col: o.col || '#ffd23f',
      update() { const p = typeof pos === 'function' ? pos() : pos; return near(G.player, p, this.r) && (!this.car || G.player.car); },
      markers() { const p = typeof pos === 'function' ? pos() : pos; return [{ x: p.x, y: p.y, col: this.col, label: this.label || '', r: this.r }]; } };
  }
  function getcar(text) { return { text, update() { return !!G.player.car; }, markers() { return []; } }; }
  function beat(n, text, posFn, o) {
    o = o || {};
    return { text, targets: [], init() {
      const c = posFn();
      for (let i = 0; i < n; i++) {
        const p = Ents.makePed(o.kind || 'target', c.x + (i - (n - 1) / 2) * 46, c.y + rnd(-12, 12), { keep: true, label: o.label || 'TARGET', hp: o.hp, hue: o.hue, char: o.char });
        if (o.kind === 'rival') p.state = 'idle';
        this.targets.push(p);
      }
    }, update() { return this.targets.length > 0 && this.targets.every(t => t.dead); },
    markers() { return this.targets.filter(t => !t.dead).map(t => ({ x: t.x, y: t.y, col: '#ff3860', label: '', r: 26 })); },
    done() { this.targets.forEach(t => { t.keep = false; }); } };
  }
  function heat(text) { return { text, t: 0, init() { G.setWanted(2); }, update(dt) { this.t += dt; return this.t > 6 && G.stars === 0; }, markers() { return []; } }; }
  function chase(n, destFn, text) {
    return { text, cars: [], init() {
      const [ni, nj] = World.nearestNode(G.player.x, G.player.y);
      for (let k = 0; k < n; k++) {
        const a = Math.random() * 6.28, qx = G.player.x + Math.cos(a) * 750, qy = G.player.y + Math.sin(a) * 750, nd = World.nearestNode(qx, qy);
        const c = Ents.makeCar('sport', World.center(nd[0]), World.center(nd[1]), rnd(0, 6.28), { driver: 'rival', mode: 'chase', keep: true, rival: true, color: '#7f1d1d' });
        this.cars.push(c);
      }
    }, update() { return near(G.player, destFn(), 80) && G.player.car; }, markers() { const p = destFn(); return [{ x: p.x, y: p.y, col: '#ffd23f', label: 'DROP', r: 80 }]; },
    done() { this.cars.forEach(c => { c.keep = false; }); } };
  }

  // ---------- campaign ----------
  const CAMPAIGN = [
    { title: 'Respect The Hood', reward: 150, rep: 10,
      intro: ['Yo, fresh off the block? Hood ain\'t gonna run itself.', 'Couple of busters from Crimson Alley been posted up on my corner. Teach \'em some manners.', 'Paws only. Use [J] [K] [L] to throw hands.'],
      outro: ['That\'s what I\'m talkin\' bout! Here\'s a little somethin\' for your trouble.'],
      steps: () => [beat(2, 'Beat down the two rival busters', () => E(4, 2, 'S', 0.5), { kind: 'rival', label: 'BUSTER', hp: 50 })] },
    { title: 'Whip Appeal', reward: 250, rep: 10,
      intro: ['You can\'t hustle on foot, kitty. Go borrow a ride. Press [E] next to any car.', 'Then roll it down to the Pay-n-Spray so it stops lookin\' hot.'],
      outro: ['Clean as a whistle. Now you\'re cookin\'.'],
      steps: () => [getcar('Steal a ride'), goto(POI.spray, 'Take it to the Pay-n-Spray', { car: true, label: 'SPRAY', col: '#ff9a3c', r: 90 })] },
    { title: 'Package Run', reward: 400, rep: 15,
      intro: ['Rare wax from the Record Spot goes to the Wharf. Ninety seconds on the clock.', 'Don\'t scratch it.'],
      outro: ['Smooth. That vinyl\'s worth more than your whole wardrobe.'],
      steps: () => [goto(POI.records, 'Pick up the wax at the Record Spot', { label: 'WAX', col: '#c78bff' }), goto(POI.docks, 'Deliver it to the Wharf in time', { time: 110, label: 'WHARF', col: '#3ec8ff', r: 90 })] },
    { title: 'Heat Check', reward: 350, rep: 15,
      intro: ['Five-O been askin\' questions about you. Let\'s see if you can shake \'em.', 'I\'ll make some noise. You lose the heat. Break line of sight and keep movin\'.'],
      outro: ['Slick. They never even got your plate.'],
      steps: () => [heat('Lose the cops')] },
    { title: 'Shakedown', reward: 600, rep: 20,
      intro: ['Three cats owe me. They think I forgot. Remind \'em.', 'Look for the red markers on your map.'],
      outro: ['Debt collected. Respect.'],
      steps: () => [
        beat(1, 'Find and shake down debtor 1 of 3', () => E(1, 5, 'N', 0.4), { label: 'DEBTOR' }),
        beat(1, 'Find and shake down debtor 2 of 3', () => E(5, 6, 'W', 0.5), { label: 'DEBTOR' }),
        beat(1, 'Find and shake down debtor 3 of 3', () => E(6, 3, 'N', 0.5), { label: 'DEBTOR' })] },
    { title: 'King Of The Hood', reward: 2000, rep: 50, finale: true,
      intro: ['Last job, and it\'s the big one. The stash house up in the Heights.', 'Grab the bag, get in a ride, and get it to the Wharf. Rivals gonna come at you hard.', 'Do this and the whole city bows.'],
      outro: ['You did it. The hood respects you now.'],
      steps: () => [goto(POI.stash, 'Grab the bag at the stash house', { label: 'STASH', col: '#ff3860' }), getcar('Get in a ride'),
        chase(3, () => POI.docks, 'Get the bag to the Wharf. Shake the rivals!')] },
  ];

  function courier() {
    const keys = ['records', 'stash', 'bodega', 'fits', 'spray', 'home', 'docks', 'jail'];
    let a = keys[Math.floor(Math.random() * keys.length)], b = a, tries = 0;
    while ((b === a || Math.hypot(POI[a].x - POI[b].x, POI[a].y - POI[b].y) < 1500) && tries++ < 20) b = keys[Math.floor(Math.random() * keys.length)];
    const d = Math.hypot(POI[a].x - POI[b].x, POI[a].y - POI[b].y);
    return { title: 'Courier Job', reward: Math.round(140 + d / 9), rep: 4, repeat: true,
      intro: ['Got a package that needs to move, ' + POI[a].name.toLowerCase() + ' to ' + POI[b].name.toLowerCase() + '. Make it quick.'],
      outro: ['Cash money. Come see me for more.'],
      steps: () => [goto(POI[a], 'Pick up the package at ' + POI[a].name, { label: 'PICKUP', col: '#c78bff' }), goto(POI[b], 'Deliver to ' + POI[b].name, { time: Math.round(30 + d / 150), label: 'DROP', col: '#3ef2a0', r: 80 })] };
  }

  // ---------- flow ----------
  function say(lines, cb, speaker, choices) { dialog = { lines, i: 0, cb, speaker: speaker || OG, t: 0, choices: choices || null }; Snd.play('blip'); }
  function advance() {
    if (!dialog) return;
    if (dialog.choices && dialog.i >= dialog.lines.length - 1) return;      // waiting for a choice
    dialog.i++; Snd.play('blip');
    if (dialog.i >= dialog.lines.length) { const cb = dialog.cb; dialog = null; if (cb) cb(); } else dialog.t = 0;
  }
  function choose(i) {
    if (!dialog || !dialog.choices || dialog.i < dialog.lines.length - 1 || !dialog.choices[i]) return;
    const c = dialog.choices[i]; dialog = null; Snd.play('blip'); if (c.cb) c.cb();
  }

  function available() { return idx < CAMPAIGN.length ? CAMPAIGN[idx] : null; }
  function ogMarker() {
    if (active || dialog) return null;
    return { x: POI.og.x, y: POI.og.y, col: '#ffd23f', label: idx < CAMPAIGN.length ? 'MISSION' : 'JOB', r: 55, icon: '!' };
  }
  function startFromOG() {
    if (active || dialog) return false;
    const def = available() || courier();
    say(def.intro, () => begin(def)); return true;
  }
  // OG rings you up: same job, no need to walk over
  function callIn() {
    if (active || dialog) return false;
    const def = available() || courier();
    say(['(phone) ' + def.intro[0]].concat(def.intro.slice(1)), () => begin(def), 'OG WHISKERS · PHONE'); return true;
  }
  const FAV = ['bodega', 'fits', 'records', 'spray', 'home', 'pawn'];
  function favorDef(from) {
    let k = FAV[Math.floor(Math.random() * FAV.length)], tries = 0;
    while (Math.hypot(POI[k].x - from.x, POI[k].y - from.y) < 900 && tries++ < 12) k = FAV[Math.floor(Math.random() * FAV.length)];
    const d = Math.hypot(POI[k].x - from.x, POI[k].y - from.y), reward = Math.round(50 + d / 14);
    return { title: 'Favor', reward, rep: 2, repeat: true, intro: [], outro: ['Appreciate you, bro. Here\'s your cut.'],
      steps: () => [goto(POI[k], 'Run the envelope to ' + POI[k].name, { time: Math.round(40 + d / 80), label: 'DROP', col: '#3ef2a0', r: 80 })], where: POI[k].name, reward2: reward };
  }
  function begin(def) {
    active = { def, steps: def.steps(), si: 0, elapsed: 0, stepT: 0 };
    initStep();
    banner = { text: def.title.toUpperCase(), sub: 'MISSION START', t: 3, col: '#ffd23f' };
  }
  function initStep() { const s = active.steps[active.si]; active.stepT = 0; if (s.init) s.init(); }
  function cleanup() { for (const s of active.steps) if (s.done) s.done(); }
  function pass() {
    const def = active.def; cleanup();
    G.addCash(def.reward); G.addRep(def.rep); Snd.play('pass');
    banner = { text: 'MISSION PASSED', sub: '+$' + def.reward + '  ·  +' + def.rep + ' RESPECT', t: 4.5, col: '#3ef2a0' };
    const fin = def.finale; active = null;
    if (!def.repeat) idx++;
    G.save();
    say(def.outro, () => { if (fin) { endless = true; G.showEnding(); } });
  }
  function fail(reason) {
    if (!active) return;
    cleanup(); Snd.play('fail');
    banner = { text: 'MISSION FAILED', sub: reason, t: 4, col: '#ff3860' };
    for (const t of active.steps) if (t.targets) t.targets.forEach(p => { p.keep = false; });
    active = null;
  }
  function update(dt) {
    if (banner) { banner.t -= dt; if (banner.t <= 0) banner = null; }
    if (dialog) dialog.t += dt;
    if (!active) return;
    active.elapsed += dt; active.stepT += dt;
    const s = active.steps[active.si];
    if (s.time && active.stepT > s.time) { fail('You ran out of time'); return; }
    if (s.update(dt)) {
      if (s.done) s.done();
      Snd.play('buy');
      active.si++;
      if (active.si >= active.steps.length) pass(); else initStep();
    }
  }
  function onDown(reason) { if (active) fail(reason); }
  function markers() {
    const out = [];
    if (active) { const s = active.steps[active.si]; for (const m of s.markers()) out.push(m); }
    const og = ogMarker(); if (og) out.push(og);
    return out;
  }
  function objective() {
    if (!active) return null;
    const s = active.steps[active.si];
    return { title: active.def.title, text: s.text, time: s.time ? Math.max(0, s.time - active.stepT) : null, step: active.si + 1, steps: active.steps.length };
  }
  function reset() { active = null; dialog = null; banner = null; }
  return { update, markers, objective, onDown, say, advance, choose, reset, startFromOG, callIn, favorDef, begin, available,
    get dialog() { return dialog; }, get banner() { return banner; }, get active() { return !!active; },
    get idx() { return idx; }, set idx(v) { idx = v; }, get endless() { return endless; }, set endless(v) { endless = v; }, total: CAMPAIGN.length };
})();
