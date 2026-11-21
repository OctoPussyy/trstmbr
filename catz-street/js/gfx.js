// Photoreal-leaning renderer: HDR image-based lighting, sun shadows, bloom + ACES tone mapping, blended sky photos, fog.
// The simulation stays 2D; 1 sim px = 1/20 m, sim (x,y) -> world (x, 0, y).
const Gfx = (() => {
  const K = 1 / 20, { SIZE } = World;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  let renderer, scene, camera, composer, bloom, fxaa, cityGroup, intGroup = null, sky, sun, hemi, quality = 'high', cityApi = null, pmrem, envName = null, envBusy = false;
  const markerPool = [], poiRings = [], tracers = [], fxSprites = [];
  const tmp = new THREE.Vector3(), spriteTint = new THREE.Color(1, 1, 1), fogCol = new THREE.Color(0x8a8aa0);
  let headSpot = null, copLights = [], horizon = {};

  function tex(w, h, draw, opts) {
    const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = (opts && opts.aniso) || 4; if (opts && opts.repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
  }
  const radial = (stops, size) => tex(size || 128, size || 128, (x, w, h) => { const g = x.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); for (const [o, c] of stops) g.addColorStop(o, c); x.fillStyle = g; x.fillRect(0, 0, w, h); });
  const mergeGeos = list => THREE.BufferGeometryUtils.mergeGeometries(list);

  // ------------------------------------------------------------------ init
  function init(canvas, q) {
    quality = q || 'high';
    renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false });
    renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, quality === 'high' ? 1.5 : 1));
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    scene = new THREE.Scene(); scene.fog = new THREE.FogExp2(fogCol, 0.0042);
    camera = new THREE.PerspectiveCamera(60, 1, 0.2, 700);
    hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 0.35); scene.add(hemi);
    sun = new THREE.DirectionalLight(0xffffff, 3); sun.castShadow = true;
    const ss = quality === 'high' ? 2048 : 1024; sun.shadow.mapSize.set(ss, ss);
    const sc = sun.shadow.camera; sc.left = -48; sc.right = 48; sc.top = 48; sc.bottom = -48; sc.near = 1; sc.far = 400; sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03;
    scene.add(sun, sun.target);
    // fixed light pool (the count never changes, so shaders never recompile mid-game)
    headSpot = new THREE.SpotLight(0xfff1d6, 0, 46, 0.55, 0.55, 1.3); headSpot.castShadow = false; scene.add(headSpot, headSpot.target);
    for (let i = 0; i < 2; i++) { const l = new THREE.PointLight(0xff2030, 0, 26, 1.6); scene.add(l); copLights.push(l); }
    pmrem = new THREE.PMREMGenerator(renderer);
    cityGroup = new THREE.Group(); scene.add(cityGroup);
    buildSky();
    cityApi = City.build(cityGroup, K);
    buildMarkers(); buildFx();
    setupComposer();
    return renderer;
  }
  function setupComposer() {
    if (quality === 'low') { composer = null; return; }
    composer = new THREE.EffectComposer(renderer);
    composer.addPass(new THREE.RenderPass(scene, camera));
    bloom = new THREE.UnrealBloomPass(new THREE.Vector2(512, 512), 0.6, 0.5, 2.6); composer.addPass(bloom);
    composer.addPass(new THREE.OutputPass());
    fxaa = new THREE.ShaderPass(THREE.FXAAShader); composer.addPass(fxaa);
  }
  function resize(w, h) {
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
    if (composer) { const pr = renderer.getPixelRatio(); composer.setPixelRatio(pr); composer.setSize(w, h); bloom.resolution.set(w * pr * 0.5, h * pr * 0.5); fxaa.material.uniforms.resolution.value.set(1 / (w * pr), 1 / (h * pr)); }
  }
  function setQuality(q) { quality = q; renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, q === 'high' ? 1.5 : 1)); setupComposer(); }

  // ------------------------------------------------------------------ sky + time of day
  const BANDS = [[0, 'night'], [4.9, 'night'], [6.3, 'dawn'], [8.6, 'noon'], [15.4, 'noon'], [17.3, 'late_afternoon'], [18.9, 'dusk_2'], [20.5, 'night'], [24, 'night']];
  const LOOK = { night: { exp: 1.0, env: 0.15, fog: 0.003, sprite: [0.4, 0.46, 0.7] }, dawn: { exp: 0.95, env: 1.3, fog: 0.0026, sprite: [1, 0.86, 0.8] },
    noon: { exp: 0.78, env: 1.5, fog: 0.0016, sprite: [1, 1, 1] }, late_afternoon: { exp: 0.85, env: 1.45, fog: 0.0019, sprite: [1, 0.95, 0.88] }, dusk_2: { exp: 0.95, env: 1.25, fog: 0.0024, sprite: [1, 0.82, 0.88] } };
  function bandAt(h) { for (let i = 1; i < BANDS.length; i++) if (h <= BANDS[i][0]) { const a = BANDS[i - 1], b = BANDS[i]; return { A: a[1], B: b[1], t: b[0] > a[0] ? (h - a[0]) / (b[0] - a[0]) : 0 }; } return { A: 'night', B: 'night', t: 0 }; }
  function buildSky() {
    const mat = new THREE.ShaderMaterial({
      uniforms: { tA: { value: null }, tB: { value: null }, mixAB: { value: 0 }, gain: { value: 1.7 }, tint: { value: new THREE.Color(1, 1, 1) } },
      vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize((modelMatrix * vec4(position,1.0)).xyz - cameraPosition); gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position,1.0); gl_Position.z = gl_Position.w; }',
      fragmentShader: `uniform sampler2D tA; uniform sampler2D tB; uniform float mixAB; uniform float gain; uniform vec3 tint; varying vec3 vDir;
        void main(){ vec3 d = normalize(vDir); float e = asin(clamp(d.y,-1.,1.)); float v = clamp((e + 0.0982) / 1.6690, 0.002, 0.998); float u = atan(d.z, d.x) / 6.2831853 + 0.5;
          vec3 a = texture2D(tA, vec2(u, v)).rgb, b = texture2D(tB, vec2(u, v)).rgb; vec3 c = mix(a, b, mixAB) * tint * gain;
          gl_FragColor = vec4(c, 1.0);
          #include <colorspace_fragment>
        }`,
      side: THREE.BackSide, depthWrite: false, depthTest: true, fog: false });
    sky = new THREE.Mesh(new THREE.SphereGeometry(500, 48, 24), mat); sky.frustumCulled = false; sky.renderOrder = -1; scene.add(sky);
    for (const k in Assets.skies) horizon[k] = horizonColor(Assets.skies[k]);
  }
  function horizonColor(t) {
    if (!t || !t.image) return new THREE.Color(0.6, 0.6, 0.7);
    const c = document.createElement('canvas'); c.width = 64; c.height = 32; const x = c.getContext('2d'); x.drawImage(t.image, 0, 0, 64, 32);
    const d = x.getImageData(0, 24, 64, 4).data; let r = 0, g = 0, b = 0; for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; } const n = d.length / 4;
    return new THREE.Color().setRGB(r / n / 255, g / n / 255, b / n / 255, THREE.SRGBColorSpace);
  }
  function applyEnv(name) {
    if (envName === name || envBusy) return; envBusy = true;
    Assets.loadEnv(name).then(t => {
      const rt = pmrem.fromEquirectangular(t); if (scene.environment && scene.environment !== rt.texture) scene.environment.dispose(); scene.environment = rt.texture; envName = name; envBusy = false;
      const k = LOOK[name].env; scene.traverse(o => { if (o.material) for (const m of [].concat(o.material)) if (m.isMeshStandardMaterial) m.envMapIntensity = intGroup ? 0.6 : k; });
    }).catch(() => { envBusy = false; });
  }
  const sunDir = new THREE.Vector3();
  let lastBand = null, curSprite = [1, 1, 1], gameT = 0, darkK = 0;
  function setTime(hour, amb, dark, t) {
    gameT = t || gameT; darkK = dark;
    const b = bandAt(hour), LA = LOOK[b.A], LB = LOOK[b.B], m = b.t * b.t * (3 - 2 * b.t);
    sky.material.uniforms.tA.value = Assets.skies[b.A]; sky.material.uniforms.tB.value = Assets.skies[b.B]; sky.material.uniforms.mixAB.value = m;
    const lerp = (x, y) => x + (y - x) * m;
    renderer.toneMappingExposure = intGroup ? 0.9 : lerp(LA.exp, LB.exp);
    const night = hour < 5.6 || hour > 20.2;
    sky.material.uniforms.tint.value.setRGB(night ? 0.75 : 1, night ? 0.85 : 1, night ? 1.25 : 1);
    fogCol.copy(horizon[b.A] || fogCol).lerp(horizon[b.B] || fogCol, m).multiplyScalar(0.82); if (night) fogCol.multiplyScalar(0.6).lerp(new THREE.Color(0.06, 0.08, 0.16), 0.5);
    if (!intGroup) { scene.fog.color.copy(fogCol); scene.fog.density = lerp(LA.fog, LB.fog); }
    curSprite = [0, 1, 2].map(i => lerp(LA.sprite[i], LB.sprite[i]));
    applyEnv(m < 0.5 ? b.A : b.B);
    // sun / moon
    const day = clamp((hour - 5.8) / (19.8 - 5.8), 0, 1), elev = Math.sin(day * Math.PI) * 1.15, az = -0.9 + day * 2.2;
    if (hour > 5.8 && hour < 19.8) {
      sunDir.set(Math.cos(az) * Math.cos(elev), Math.max(0.06, Math.sin(elev)), Math.sin(az) * Math.cos(elev)).normalize();
      const low = 1 - clamp(Math.sin(elev) * 2.2, 0, 1); sun.color.setRGB(1, 0.92 - low * 0.35, 0.82 - low * 0.55); sun.intensity = intGroup ? 0 : 0.6 + 2.6 * clamp(Math.sin(elev) * 1.6, 0, 1);
    } else { sunDir.set(-0.4, 0.75, 0.5).normalize(); sun.color.setRGB(0.55, 0.65, 1); sun.intensity = intGroup ? 0 : 0.14; }
    hemi.color.copy(fogCol).lerp(new THREE.Color(1, 1, 1), 0.4); hemi.groundColor.setRGB(0.15, 0.13, 0.12); hemi.intensity = intGroup ? 1.2 : 0.05 + Math.pow(1 - dark, 2) * 0.5;
    if (intGroup) { hemi.color.setRGB(1, 0.92, 0.82); hemi.groundColor.setRGB(0.4, 0.33, 0.3); }
    if (cityApi) cityApi.update(gameT, dark);
    const tintMul = intGroup ? [1, 0.96, 0.9] : curSprite; spriteTint.setRGB(tintMul[0], tintMul[1], tintMul[2]);
  }

  // ------------------------------------------------------------------ markers
  function buildMarkers() {
    const mk = () => {
      const g = new THREE.Group(), add = THREE.AdditiveBlending;
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.86, 1, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.9, blending: add, depthWrite: false, side: THREE.DoubleSide, fog: false }));
      const disc = new THREE.Mesh(new THREE.CircleGeometry(1, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.16, blending: add, depthWrite: false, side: THREE.DoubleSide, fog: false }));
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 60, 24, 1, true).translate(0, 30, 0), new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.16, blending: add, depthWrite: false, side: THREE.DoubleSide, fog: false }));
      ring.position.y = disc.position.y = 0.2; g.add(ring, disc, beam); g.userData = { ring, disc, beam }; g.visible = false; cityGroup.add(g); return g;
    };
    for (let i = 0; i < 6; i++) markerPool.push(mk());
    for (const k in World.POI) { const m = mk(), p = World.POI[k]; m.userData.beam.visible = false; m.userData.ring.material.color.set(p.col); m.userData.disc.material.color.set(p.col); m.position.set(p.x * K, 0, p.y * K); m.scale.set(1.3, 1, 1.3); m.userData.poi = k; poiRings.push(m); }
  }
  function setMarkers(list, t) {
    markerPool.forEach((g, i) => {
      const m = list[i]; if (!m) { g.visible = false; return; }
      g.visible = true; const r = Math.max(1.4, Math.min(m.r || 60, 90) * K); g.position.set(m.x * K, 0, m.y * K); g.scale.set(r, 1, r);
      for (const k of ['ring', 'disc', 'beam']) g.userData[k].material.color.set(m.col);
      g.userData.ring.material.opacity = 0.6 + 0.35 * Math.sin(t * 4); g.userData.beam.scale.set(0.3, 1, 0.3);
      const cd = Math.hypot(camera.position.x - g.position.x, camera.position.z - g.position.z); g.userData.beam.material.opacity = 0.16 * Math.max(0, Math.min(1, (cd - 8) / 30));
    });
    for (const g of poiRings) { const k = g.userData.poi; g.visible = k !== 'og' && k !== 'stash' && !intGroup; }
  }

  // ------------------------------------------------------------------ fx (smoke, fire, sparks, tracers)
  let smokeTex, fireTex;
  function buildFx() {
    smokeTex = radial([[0, 'rgba(70,70,70,.75)'], [1, 'rgba(70,70,70,0)']]); fireTex = radial([[0, 'rgba(255,240,180,1)'], [0.35, 'rgba(255,150,50,.85)'], [1, 'rgba(255,60,0,0)']]);
    for (let i = 0; i < 140; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTex, transparent: true, depthWrite: false })); s.visible = false; cityGroup.add(s); fxSprites.push(s); }
    for (let i = 0; i < 8; i++) { const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 0, 1)]), new THREE.LineBasicMaterial({ color: new THREE.Color(4, 3.4, 1.6), transparent: true, fog: false })); l.visible = false; l.frustumCulled = false; scene.add(l); tracers.push({ l, t: 0 }); }
  }
  function syncFx(fx) {
    let n = 0;
    for (const f of fx) {
      if (f.t === 'txt' || f.t === 'ring') continue; if (n >= fxSprites.length) break;
      const s = fxSprites[n++], a = Math.max(0, f.life / f.max); s.visible = true;
      s.position.set(f.x * K, 1.2 + (1 - a) * (f.t === 'smoke' ? 3.5 : 1.5), f.y * K);
      if (f.t === 'smoke') { s.material.map = smokeTex; s.material.opacity = 0.7 * a; s.scale.setScalar(f.r * K * 4); s.material.blending = THREE.NormalBlending; s.material.color.setRGB(f.col / 90, f.col / 90, f.col / 90); }
      else { s.material.map = fireTex; s.material.opacity = a; s.scale.setScalar(f.t === 'fire' ? f.r * K * 4.5 : 0.4); s.material.blending = THREE.AdditiveBlending; s.material.color.setRGB(3, 2.4, 1.6); }
    }
    for (; n < fxSprites.length; n++) fxSprites[n].visible = false;
  }
  function tracer(x0, y0, x1, y1, h) {
    const t = tracers.find(q => q.t <= 0) || tracers[0]; t.t = 0.08;
    const p = t.l.geometry.attributes.position; p.setXYZ(0, x0 * K, h || 1.4, y0 * K); p.setXYZ(1, x1 * K, h || 1.4, y1 * K); p.needsUpdate = true; t.l.visible = true;
  }

  // ------------------------------------------------------------------ billboard characters (the Catz keep their hand-drawn look)
  const FW = 128, FH = 192, COLS = 4, ROWS = 7, bank = new Map();
  function spriteSet(char, hue) {
    const key = char + ':' + (((hue % 360) + 360) % 360); if (bank.has(key)) return bank.get(key);
    const spr = Rig.sprites(char, hue), c = document.createElement('canvas'); c.width = FW * COLS; c.height = FH * ROWS; const x = c.getContext('2d');
    const M = Poses.Moves, frames = [];
    frames.push({ p: Poses.make({ py: 52, tr: 3, hrx: 70, hry: 250, hlx: 110, hly: 262 }) }, { p: Poses.make({ py: 58, tr: 4, hrx: 76, hry: 244, hlx: 118, hly: 256 }) });
    for (let i = 0; i < 8; i++) frames.push({ p: Poses.walk(i / 8 * Math.PI * 2, 1) });
    for (const m of ['LP', 'HP', 'LK']) { const mv = M[m]; for (const t of [mv.S * 0.7, mv.S + 1, mv.S + mv.A + mv.R * 0.3]) frames.push({ p: Poses.sample(mv.kf, t, mv.base) }); }
    for (const u of [0.35, 0.75, 1]) frames.push({ p: Poses.fall(u), s: 0.078, gy: 150 });
    const aim = { tr: 12, px: 16, py: 50, hrx: 440, hry: -8, hlx: 330, hly: 50 };
    frames.push({ p: Poses.make(aim), gun: 1 }, { p: Poses.make(Object.assign({}, aim, { tr: 7, px: 6 })), gun: 2 });
    frames.push({ p: Poses.poses.taunt }, { p: Poses.poses.hitHigh });
    frames.forEach((f, i) => {
      const col = i % COLS, row = Math.floor(i / COLS), s = f.s || 0.112, cx = col * FW + FW / 2 - 6, gy = row * FH + (f.gy || 186);
      x.save(); x.beginPath(); x.rect(col * FW, row * FH, FW, FH); x.clip();
      const sk = Rig.draw(x, spr, f.p, cx, gy, 1, s);
      if (f.gun) {
        const J = spr.def.joints, W = sk.arm_r.W, gx = cx + (W[0] - J.center_x) * s, gy2 = gy + (W[1] - J.ground_y) * s;
        x.fillStyle = '#15151b'; x.fillRect(gx - 2, gy2 - 5, 27, 8); x.fillRect(gx - 2, gy2 + 1, 9, 13); x.fillStyle = '#6b7280'; x.fillRect(gx + 4, gy2 - 5, 18, 2);
        if (f.gun === 2) { x.fillStyle = '#ffe27a'; x.beginPath(); x.moveTo(gx + 25, gy2 - 1); x.lineTo(gx + 40, gy2 - 10); x.lineTo(gx + 36, gy2 - 1); x.lineTo(gx + 42, gy2 + 8); x.closePath(); x.fill(); }
      }
      x.restore();
    });
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.minFilter = THREE.LinearFilter; t.magFilter = THREE.LinearFilter; t.generateMipmaps = false;
    const set = { tex: t }; bank.set(key, set); return set;
  }
  const pedGeo = new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0), pedViews = new Map();
  const PH = 1.95, PW = PH * FW / FH;
  let blobT = null;
  function makeView(p, parent) {
    const set = spriteSet(p.char, p.hue), t = set.tex.clone(); t.needsUpdate = true; t.repeat.set(1 / COLS, 1 / ROWS);
    const mat = new THREE.MeshBasicMaterial({ map: t, transparent: true, alphaTest: 0.3, side: THREE.DoubleSide });
    const m = new THREE.Mesh(pedGeo, mat); m.scale.set(PW, PH, 1);
    const grp = new THREE.Group(); grp.add(m);
    if (!blobT) blobT = radial([[0, 'rgba(0,0,0,.6)'], [0.55, 'rgba(0,0,0,.3)'], [1, 'rgba(0,0,0,0)']], 64);
    const sh = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.8).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: blobT, transparent: true, depthWrite: false })); sh.position.y = 0.02; grp.add(sh);
    (parent || cityGroup).add(grp); return { grp, m, mat, t, key: p.char + ':' + p.hue, fx: 1 };
  }
  function billboard(parent, char, hue) {
    const v = makeView({ char, hue }, parent), white = new THREE.Color(1, 1, 1);
    return { grp: v.grp, face(th, fx, frame, tint) { v.m.rotation.y = th; v.m.scale.x = PW * fx; setFrame(v, frame); v.mat.color.copy(tint || white); } };
  }
  function pickFrame(p, now) {
    if (p.dead || p.down > 0) { const u = p.dead ? Math.min(1, p.downT / 0.45) : p.down < 0.5 ? p.down / 0.5 : Math.min(1, p.downT / 0.4); return 19 + (u < 0.4 ? 0 : u < 0.85 ? 1 : 2); }
    if (p.atk) { const mv = Poses.Moves[p.atk.m], base = p.atk.m === 'LP' ? 10 : p.atk.m === 'HP' ? 13 : 16, t = p.atk.t; return base + (t < mv.S ? 0 : t < mv.S + mv.A + 2 ? 1 : 2); }
    if (p.gunUp || p.aiming) return p.firing > 0 ? 23 : 22;
    if (p.talk) return 24;
    if (p.flash > 0.1) return 25;
    const sp = Math.hypot(p.vx || 0, p.vy || 0);
    if (sp > 12) return 2 + (Math.floor((((p.walkPh % 6.2832) + 6.2832) % 6.2832) / 6.2832 * 8) % 8);
    return Math.floor(now * 1.5 + (p.seed || 0)) % 2;
  }
  function setFrame(v, i) { v.t.offset.set((i % COLS) / COLS, 1 - (Math.floor(i / COLS) + 1) / ROWS); }
  const groundY = (x, y) => World.blockAt(x, y) ? City.H0 : 0;
  function syncPeds(peds, yaw, time) {
    const seen = new Set(), rx = -Math.sin(yaw), rz = Math.cos(yaw), th = Math.atan2(-Math.cos(yaw), -Math.sin(yaw));
    for (const p of peds) {
      let v = pedViews.get(p); if (!v || v.key !== p.char + ':' + p.hue) { if (v) cityGroup.remove(v.grp); v = makeView(p); pedViews.set(p, v); }
      seen.add(p); if (p.hidden) { v.grp.visible = false; continue; } v.grp.visible = true;
      v.grp.position.set(p.x * K, groundY(p.x, p.y), p.y * K); v.m.rotation.y = th;
      const hx = p.hx === undefined ? 1 : p.hx, hz = p.hy === undefined ? 0 : p.hy, d = hx * rx + hz * rz; if (Math.abs(d) > 0.12) v.fx = d > 0 ? 1 : -1;
      v.m.scale.x = PW * v.fx; setFrame(v, pickFrame(p, time));
      v.mat.color.copy(spriteTint); if (p.flash > 0) v.mat.color.setRGB(2.2, 1.6, 1.6);
    }
    for (const [p, v] of pedViews) if (!seen.has(p)) { cityGroup.remove(v.grp); v.mat.dispose(); v.t.dispose(); pedViews.delete(p); }
  }

  // ------------------------------------------------------------------ vehicles + their lights
  function syncCars(cars, time, player) {
    Cars.sync(cityGroup, cars, time, darkK, camera.position);
    // player headlights at night, police strobes near the camera
    const pc = player && player.car;
    if (pc && darkK > 0.25 && !intGroup) { const f = [Math.cos(pc.a), Math.sin(pc.a)]; headSpot.position.set((pc.x + f[0] * pc.len * 0.45) * K, 0.9, (pc.y + f[1] * pc.len * 0.45) * K); headSpot.target.position.set((pc.x + f[0] * 600) * K, 0, (pc.y + f[1] * 600) * K); headSpot.intensity = 260 * Math.min(1, (darkK - 0.25) * 3); }
    else headSpot.intensity = 0;
    const cops = intGroup ? [] : cars.filter(c => c.type === 'police' && !c.wreck && c.driver === 'cop').sort((a, b) => (Math.hypot(a.x - player.x, a.y - player.y) - Math.hypot(b.x - player.x, b.y - player.y))).slice(0, 2);
    copLights.forEach((l, i) => { const c = cops[i]; if (!c) { if (!l.userData.interior) l.intensity = 0; return; } l.userData.interior = false; const f = Math.floor(time * 8 + i) % 2; l.color.setHex(f ? 0xff2030 : 0x2050ff); l.position.set(c.x * K, 2.2, c.y * K); l.intensity = 40 + darkK * 160; });
  }
  function interiorLights(list) { copLights.forEach((l, i) => { const q = list && list[i]; l.userData.interior = !!q; if (q) { l.position.set(q[0], q[1], q[2]); l.color.setHex(q[3]); l.intensity = q[4]; l.distance = 20; } else { l.intensity = 0; l.distance = 26; } }); }

  // ------------------------------------------------------------------ interior hook, camera, render
  function setInterior(g) {
    if (intGroup) scene.remove(intGroup);
    intGroup = g; cityGroup.visible = !g; sky.visible = !g;
    if (g) { scene.add(g); scene.fog.color.set(0x120a18); scene.fog.density = 0.0; }
    const k = g ? 0.6 : (envName ? LOOK[envName].env : 1); scene.traverse(o => { if (o.material) for (const m of [].concat(o.material)) if (m.isMeshStandardMaterial) m.envMapIntensity = k; });
  }
  function setCamera(px, py, pz, tx, ty, tz, fov) {
    camera.position.set(px, py, pz); camera.lookAt(tx, ty, tz); if (fov && Math.abs(camera.fov - fov) > 0.05) { camera.fov = fov; camera.updateProjectionMatrix(); }
    sky.position.copy(camera.position); if (cityApi) cityApi.cull(camera.position.x, camera.position.z);
    // sun shadow box follows the camera target, snapped to shadow texels to avoid shimmer
    const ss = sun.shadow.mapSize.x, unit = 96 / ss; let cx = Math.round(tx / unit) * unit, cz = Math.round(tz / unit) * unit;
    sun.target.position.set(cx, 0, cz); sun.position.set(cx + sunDir.x * 150, sunDir.y * 150, cz + sunDir.z * 150);
  }
  function project(x, y, h, w, hh) { const v = tmp.set(x * K, h, y * K).project(camera); return { x: (v.x * 0.5 + 0.5) * w, y: (-v.y * 0.5 + 0.5) * hh, vis: v.z < 1 && v.z > -1 }; }
  function update(dt) { for (const t of tracers) if (t.t > 0) { t.t -= dt; t.l.material.opacity = Math.max(0, t.t / 0.08); if (t.t <= 0) t.l.visible = false; } }
  let frameN = 0;
  function render() { frameN++; renderer.shadowMap.autoUpdate = false; if (frameN % 2 === 0 || quality === 'high' && frameN % 2 === 1 && false) renderer.shadowMap.needsUpdate = true; if (composer) composer.render(); else renderer.render(scene, camera); }
  return { K, init, resize, setTime, setQuality, billboard, pickFrame, syncCars, syncPeds, syncFx, setMarkers, setInterior, interiorLights, setCamera, project, tracer, update, render, spriteSet, tex, radial, mergeGeos,
    get scene() { return scene; }, get camera() { return camera; }, get renderer() { return renderer; }, get quality() { return quality; }, get spriteTint() { return spriteTint; }, groundY };
})();
