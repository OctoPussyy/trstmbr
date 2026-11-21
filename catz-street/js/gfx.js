// Three.js renderer for the city. The simulation (ents.js) stays 2D; 1 sim px = 1/16 m, sim (x,y) -> world (x, 0, y).
const Gfx = (() => {
  THREE.ColorManagement.enabled = false;
  const K = 1 / 16, { R, P, N, B, SW, SIZE } = World;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  let renderer, scene, camera, hemi, sun, skyMesh, skyGeo, starPts, sunSprite, glowPts, cityGroup, intGroup = null, fogCol;
  const nightMats = [];                        // materials whose emissive follows the dark
  const markerPool = [], poiRings = [], tracers = [], fxSprites = [];
  const col = (r, g, b) => new THREE.Color(r / 255, g / 255, b / 255);

  function tex(w, h, draw, opts) {
    const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c); t.anisotropy = (opts && opts.aniso) || 4; if (opts && opts.repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
  }
  function mergeGeos(list) {
    let vc = 0, ic = 0; for (const g of list) { vc += g.attributes.position.count; ic += g.index ? g.index.count : g.attributes.position.count; }
    const pos = new Float32Array(vc * 3), nor = new Float32Array(vc * 3), uv = new Float32Array(vc * 2), idx = new Uint32Array(ic);
    let vo = 0, io = 0;
    for (const g of list) {
      const n = g.attributes.position.count; pos.set(g.attributes.position.array, vo * 3); nor.set(g.attributes.normal.array, vo * 3); uv.set(g.attributes.uv.array, vo * 2);
      if (g.index) for (let i = 0; i < g.index.count; i++) idx[io++] = g.index.array[i] + vo; else for (let i = 0; i < n; i++) idx[io++] = i + vo;
      vo += n;
    }
    const m = new THREE.BufferGeometry(); m.setAttribute('position', new THREE.BufferAttribute(pos, 3)); m.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); m.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); m.setIndex(new THREE.BufferAttribute(idx, 1)); return m;
  }
  const radial = (stops, size) => tex(size || 128, size || 128, (x, w, h) => { const g = x.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); for (const [o, c] of stops) g.addColorStop(o, c); x.fillStyle = g; x.fillRect(0, 0, w, h); });

  // ------------------------------------------------------------------ init
  function init(canvas) {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: (window.devicePixelRatio || 1) < 2, powerPreference: 'high-performance' });
    renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    scene = new THREE.Scene(); fogCol = new THREE.Color(0x806080); scene.fog = new THREE.Fog(fogCol, 50, 250);
    camera = new THREE.PerspectiveCamera(62, 1, 0.25, 520);
    hemi = new THREE.HemisphereLight(0xffffff, 0x505070, 1.0); scene.add(hemi);
    sun = new THREE.DirectionalLight(0xffe0b0, 0.5); sun.position.set(-0.6, 1, -0.4); scene.add(sun);
    cityGroup = new THREE.Group(); scene.add(cityGroup);
    buildSky(); buildGround(); buildBuildings(); buildDecor(); buildMarkers(); buildFx();
    return renderer;
  }
  function resize(w, h) { renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }

  // ------------------------------------------------------------------ sky
  const SKY = [[0, [8, 10, 36], [40, 34, 96]], [5, [16, 20, 60], [70, 60, 130]], [6.5, [90, 110, 190], [255, 160, 140]], [8, [70, 140, 235], [190, 225, 255]], [16.5, [70, 140, 235], [190, 225, 255]],
    [18, [70, 70, 190], [255, 150, 95]], [19.5, [44, 22, 120], [255, 70, 150]], [21, [14, 12, 50], [120, 60, 140]], [24, [8, 10, 36], [40, 34, 96]]];
  function skyAt(h) {
    for (let i = 1; i < SKY.length; i++) if (h <= SKY[i][0]) { const a = SKY[i - 1], b = SKY[i], u = (h - a[0]) / (b[0] - a[0]); const L = (p, q) => p.map((v, k) => v + (q[k] - v) * u); return { top: L(a[1], b[1]), hor: L(a[2], b[2]) }; }
    return { top: SKY[0][1], hor: SKY[0][2] };
  }
  function buildSky() {
    skyGeo = new THREE.SphereGeometry(420, 24, 16); skyGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(skyGeo.attributes.position.count * 3), 3));
    skyMesh = new THREE.Mesh(skyGeo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false })); skyMesh.renderOrder = -10; skyMesh.frustumCulled = false; scene.add(skyMesh);
    const sp = new Float32Array(500 * 3);
    for (let i = 0; i < 500; i++) { const a = Math.random() * 6.283, e = Math.random() * 1.3 + 0.1, r = 400; sp[i * 3] = Math.cos(a) * Math.cos(e) * r; sp[i * 3 + 1] = Math.sin(e) * r; sp[i * 3 + 2] = Math.sin(a) * Math.cos(e) * r; }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    starPts = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 2, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false })); starPts.frustumCulled = false; scene.add(starPts);
    sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: radial([[0, 'rgba(255,255,230,1)'], [0.35, 'rgba(255,200,120,.95)'], [0.5, 'rgba(255,120,150,.5)'], [1, 'rgba(255,80,160,0)']], 256), fog: false, depthWrite: false, transparent: true }));
    sunSprite.scale.set(160, 160, 1); sunSprite.renderOrder = -9; scene.add(sunSprite);
  }
  function setTime(hour, amb, dark) {
    const s = skyAt(hour), top = col(...s.top), hor = col(...s.hor);
    const pos = skyGeo.attributes.position, c = skyGeo.attributes.color, tmp = new THREE.Color();
    for (let i = 0; i < pos.count; i++) { const y = pos.getY(i) / 420, t = clamp(y, 0, 1); tmp.copy(hor).lerp(top, Math.pow(t, 0.55)); if (y < 0) tmp.copy(hor).multiplyScalar(0.55); c.setXYZ(i, tmp.r, tmp.g, tmp.b); }
    c.needsUpdate = true;
    if (!intGroup) { fogCol.copy(hor).multiplyScalar(0.92); scene.fog.color.copy(fogCol); }
    if (intGroup) { hemi.color.setRGB(1, 0.93, 0.82); hemi.groundColor.setRGB(0.55, 0.45, 0.4); hemi.intensity = 1.15; sun.color.setRGB(1, 0.9, 0.8); sun.intensity = 0.45; }
    else { hemi.color.setRGB(amb[0] / 255, amb[1] / 255, amb[2] / 255); hemi.groundColor.setRGB(amb[0] / 400, amb[1] / 400, amb[2] / 330); hemi.intensity = 1.05 - dark * 0.1; sun.color.setRGB(1, 0.85 - dark * 0.3, 0.65); sun.intensity = clamp(0.9 - dark * 1.3, 0, 0.9); }
    for (const m of nightMats) m.emissiveIntensity = m.userData.k * (0.12 + dark * 1.5);
    starPts.material.opacity = clamp((dark - 0.35) * 2.4, 0, 1);
    if (glowPts) glowPts.material.opacity = clamp(dark * 1.8, 0, 0.95);
    const ang = (hour - 6.5) / 13 * Math.PI; sunSprite.userData.ang = ang; sunSprite.visible = !intGroup && ang > -0.05 && ang < Math.PI + 0.12;
    sunSprite.material.color.setRGB(1, clamp(0.75 + Math.sin(ang) * 0.5, 0, 1), clamp(0.55 + Math.sin(ang), 0, 1));
  }

  // ------------------------------------------------------------------ ground
  function buildGround() {
    const S = 1024, k = S / P;
    const gt = tex(S, S, x => {
      x.scale(k, k);
      x.fillStyle = '#8f8d9c'; x.fillRect(0, 0, P, P);
      x.fillStyle = '#2b2d36'; x.fillRect(0, 0, R, P); x.fillRect(0, 0, P, R);
      x.fillStyle = '#585668'; x.fillRect(R + SW, R + SW, B - 2 * SW, B - 2 * SW);
      x.strokeStyle = '#bdbbc9'; x.lineWidth = 3; x.strokeRect(R, R, B, B);
      x.strokeStyle = 'rgba(60,58,76,.55)'; x.lineWidth = 1.2; x.beginPath();
      for (let t = 38; t < B; t += 38) { x.moveTo(R + t, R); x.lineTo(R + t, R + SW); x.moveTo(R + t, R + B - SW); x.lineTo(R + t, R + B); x.moveTo(R, R + t); x.lineTo(R + SW, R + t); x.moveTo(R + B - SW, R + t); x.lineTo(R + B, R + t); } x.stroke();
      x.lineWidth = 3; x.strokeStyle = '#e8b923'; x.beginPath();
      x.moveTo(R / 2 - 3, R); x.lineTo(R / 2 - 3, P); x.moveTo(R / 2 + 3, R); x.lineTo(R / 2 + 3, P); x.moveTo(R, R / 2 - 3); x.lineTo(P, R / 2 - 3); x.moveTo(R, R / 2 + 3); x.lineTo(P, R / 2 + 3); x.stroke();
      x.strokeStyle = 'rgba(255,255,255,.55)'; x.beginPath(); x.moveTo(7, R); x.lineTo(7, P); x.moveTo(R - 7, R); x.lineTo(R - 7, P); x.moveTo(R, 7); x.lineTo(P, 7); x.moveTo(R, R - 7); x.lineTo(P, R - 7); x.stroke();
      x.fillStyle = 'rgba(240,240,240,.8)';
      for (let t = 14; t < R - 10; t += 20) { x.fillRect(R + 8, t, 26, 10); x.fillRect(P - 34, t, 26, 10); x.fillRect(t, R + 8, 10, 26); x.fillRect(t, P - 34, 10, 26); }
    }, { repeat: true, aniso: 8 });
    const rep = SIZE / P; gt.repeat.set(rep, rep); gt.offset.set(0, 1 - rep);
    const g = new THREE.Mesh(new THREE.PlaneGeometry(SIZE * K, SIZE * K).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ map: gt }));
    g.position.set(SIZE * K / 2, 0, SIZE * K / 2); cityGroup.add(g);
    const sand = new THREE.Mesh(new THREE.PlaneGeometry(SIZE * K + 160, SIZE * K + 160).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0xe9d49c }));
    sand.position.set(SIZE * K / 2, -0.06, SIZE * K / 2); cityGroup.add(sand);
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(2400, 2400).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0x0e7490 }));
    sea.position.set(SIZE * K / 2, -0.5, SIZE * K / 2); cityGroup.add(sea);
    // parks and plazas
    const grass = new THREE.MeshLambertMaterial({ map: tex(128, 128, (x, w, h) => { x.fillStyle = '#3f9b4a'; x.fillRect(0, 0, w, h); for (let i = 0; i < 260; i++) { x.fillStyle = Math.random() < 0.5 ? '#4fb35a' : '#368a41'; x.fillRect(Math.random() * w, Math.random() * h, 3, 3); } }, { repeat: true }) });
    grass.map.repeat.set(10, 10);
    const stone = new THREE.MeshLambertMaterial({ color: 0xc9b99b });
    for (const b of World.blocks) {
      if (b.type === 'bld') continue;
      const m = new THREE.Mesh(new THREE.PlaneGeometry((B - 2 * SW) * K, (B - 2 * SW) * K).rotateX(-Math.PI / 2), b.type === 'park' ? grass : stone);
      m.position.set((b.x + B / 2) * K, 0.03, (b.y + B / 2) * K); cityGroup.add(m);
      if (b.type === 'plaza') { const f = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.4, 0.8, 24), new THREE.MeshLambertMaterial({ color: 0x3aa6c9 })); f.position.set((b.x + B / 2) * K, 0.4, (b.y + B / 2) * K); cityGroup.add(f); }
    }
  }

  // ------------------------------------------------------------------ buildings
  const winCache = {}, roofMat = new THREE.MeshLambertMaterial({ color: 0x3c3a48 });
  function shadeHex(hex, f) { const n = parseInt(hex.slice(1), 16); return `rgb(${clamp(((n >> 16) & 255) * f, 0, 255) | 0},${clamp(((n >> 8) & 255) * f, 0, 255) | 0},${clamp((n & 255) * f, 0, 255) | 0})`; }
  function upperMat(wall) {
    if (winCache[wall]) return winCache[wall];
    const lit = [[1, 0], [0, 1], [1, 1], [0, 0]].map(() => Math.random() < 0.5);
    const draw = emis => (x, w, h) => {
      x.fillStyle = emis ? '#000' : shadeHex(wall, 0.85); x.fillRect(0, 0, w, h);
      for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) {
        const ox = i * 128 + 36, oy = j * 128 + 26, on = Math.random() < 0.45;
        if (emis) { if (on) { x.fillStyle = '#ffcf7a'; x.fillRect(ox, oy, 56, 74); } continue; }
        x.fillStyle = shadeHex(wall, 0.55); x.fillRect(ox - 5, oy - 5, 66, 84);
        x.fillStyle = on ? '#ffd98a' : '#1d2b3d'; x.fillRect(ox, oy, 56, 74);
        x.fillStyle = 'rgba(0,0,0,.35)'; x.fillRect(ox + 27, oy, 2, 74); x.fillRect(ox, oy + 36, 56, 2);
        x.fillStyle = shadeHex(wall, 1.12); x.fillRect(ox - 8, oy + 78, 72, 6);
      }
      if (!emis) { x.fillStyle = 'rgba(0,0,0,.14)'; x.fillRect(0, 124, w, 8); x.fillRect(0, 252, w, 4); }
    };
    const map = tex(256, 256, draw(false), { repeat: true }), em = tex(256, 256, draw(true), { repeat: true });
    const m = new THREE.MeshLambertMaterial({ map, emissive: 0xffffff, emissiveMap: em, emissiveIntensity: 0.3 }); m.userData.k = 1; nightMats.push(m);
    return winCache[wall] = m;
  }
  function storeMat(b) {
    const t = tex(384, 96, (x, w, h) => {
      x.fillStyle = shadeHex(b.wall, 0.8); x.fillRect(0, 0, w, h);
      x.fillStyle = '#10121c'; x.fillRect(10, 36, w - 20, h - 36);
      const g = x.createLinearGradient(0, 36, 0, h); g.addColorStop(0, '#6a5a3a'); g.addColorStop(1, '#2a2420'); x.fillStyle = g; x.fillRect(14, 40, w - 28, h - 44);
      x.fillStyle = 'rgba(255,215,140,.55)'; for (let i = 0; i < 6; i++) x.fillRect(24 + ((i * 53 + b.doorU * 300) % (w - 80)), 52 + (i % 2) * 14, 38, 10);
      x.fillStyle = 'rgba(0,0,0,.6)'; for (let i = 1; i < 6; i++) x.fillRect(i * w / 6 - 2, 36, 4, h - 36);
      const dx = b.doorU * w - 22; x.fillStyle = '#1a110b'; x.fillRect(dx, 40, 44, h - 40); x.fillStyle = '#ffd98a'; x.fillRect(dx + 6, 46, 32, 24); x.fillStyle = '#c9a24a'; x.fillRect(dx + 34, 72, 4, 8);
      x.fillStyle = b.awn; x.fillRect(dx - 12, 32, 68, 10); x.fillStyle = 'rgba(255,255,255,.75)'; for (let i = 0; i < 7; i++) x.fillRect(dx - 12 + i * 10, 32, 5, 10);
      x.fillStyle = '#0b0a14'; x.fillRect(6, 4, w - 12, 28); x.strokeStyle = b.signCol; x.lineWidth = 3; x.strokeRect(8, 6, w - 16, 24);
      x.fillStyle = b.signCol; let fs = 24; x.font = `900 ${fs}px "Arial Black", Impact, sans-serif`; while (x.measureText(b.sign).width > w - 40 && fs > 10) { fs -= 2; x.font = `900 ${fs}px "Arial Black", Impact, sans-serif`; }
      x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(b.sign, w / 2, 19);
    }, { aniso: 4 });
    const m = new THREE.MeshLambertMaterial({ map: t, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.3 }); m.userData.k = 0.55; nightMats.push(m); return m;
  }
  function addBuilding(b, grp) {
    const W = b.w * K, D = b.h * K, gh = 3.8, uh = (b.floors - 1) * 3.4 + 2;
    const cx = (b.x + b.w / 2) * K, cz = (b.y + b.h / 2) * K, um = upperMat(b.wall), sm = storeMat(b);
    const faces = { E: 0, W: 1, S: 4, N: 5 };       // BoxGeometry order: +x, -x, +y, -y, +z, -z
    const sideMats = [um, um, roofMat, roofMat, um, um];
    const gmats = [um, um, roofMat, roofMat, um, um]; gmats[faces[b.front]] = sm;
    const gg = new THREE.BoxGeometry(W, gh, D), gm = new THREE.Mesh(gg, gmats.map((m, i) => i === faces[b.front] ? sm : darkSide(b)));
    gm.position.set(cx, gh / 2, cz); grp.add(gm);
    const ug = new THREE.BoxGeometry(W * 0.985, uh, D * 0.985), uv = ug.attributes.uv;
    for (let i = 0; i < uv.count; i++) { const f = Math.floor(i / 4), fw = f < 2 ? D : W; if (f < 4 || f > 5 || true) { if (f !== 2 && f !== 3) uv.setXY(i, uv.getX(i) * fw / 8, uv.getY(i) * uh / 6.8); } }
    const um2 = new THREE.Mesh(ug, sideMats); um2.position.set(cx, gh + uh / 2, cz); grp.add(um2);
    // roof props
    const ac = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.1, 1.8), new THREE.MeshLambertMaterial({ color: 0x8c9096 })); ac.position.set(cx + (b.seed - 0.5) * W * 0.5, gh + uh + 0.55, cz + (b.seed * 7 % 1 - 0.5) * D * 0.4); grp.add(ac);
    b._center = [cx, cz, gh + uh];
  }
  const darkCache = {};
  function darkSide(b) {
    if (darkCache[b.wall]) return darkCache[b.wall];
    const m = new THREE.MeshLambertMaterial({ color: new THREE.Color(shadeHex(b.wall, 0.7)) }); return darkCache[b.wall] = m;
  }
  function buildBuildings() { for (const bl of World.blocks) for (const b of bl.bs) addBuilding(b, cityGroup); }

  // ------------------------------------------------------------------ palms, trees, lamps
  function buildDecor() {
    const palms = [], trees = [], lamps = [];
    for (const bl of World.blocks) { for (const t of bl.trees) (t.palm ? palms : trees).push(t); for (const l of bl.lamps) lamps.push(l); }
    const dummy = new THREE.Object3D();
    // palms
    const trunkG = new THREE.CylinderGeometry(0.16, 0.26, 6.5, 6).translate(0, 3.25, 0), trunkI = new THREE.InstancedMesh(trunkG, new THREE.MeshLambertMaterial({ color: 0x7a5a36 }), palms.length);
    const leaf = tex(128, 48, (x, w, h) => { x.fillStyle = '#1f9d55'; x.beginPath(); x.moveTo(0, h / 2); x.quadraticCurveTo(w * 0.5, 0, w, h / 2); x.quadraticCurveTo(w * 0.5, h, 0, h / 2); x.fill(); x.strokeStyle = '#146c3a'; x.lineWidth = 2; x.beginPath(); x.moveTo(0, h / 2); x.lineTo(w, h / 2); x.stroke(); for (let i = 1; i < 10; i++) { x.beginPath(); x.moveTo(i * 12, h / 2); x.lineTo(i * 12 + 10, i % 2 ? 4 : h - 4); x.stroke(); } });
    const fg = []; for (let i = 0; i < 7; i++) { const p = new THREE.PlaneGeometry(4.2, 1.5).translate(2.1, 0, 0).rotateZ(-0.35).rotateY(i * 0.9); p.translate(0, 6.4, 0); fg.push(p); }
    const frondI = new THREE.InstancedMesh(mergeGeos(fg), new THREE.MeshLambertMaterial({ map: leaf, alphaTest: 0.5, side: THREE.DoubleSide }), palms.length);
    palms.forEach((t, i) => { dummy.position.set(t.x * K, 0, t.y * K); dummy.rotation.set(0, t.k * 6.28, 0); dummy.scale.setScalar(0.85 + t.k * 0.4); dummy.updateMatrix(); trunkI.setMatrixAt(i, dummy.matrix); frondI.setMatrixAt(i, dummy.matrix); });
    cityGroup.add(trunkI, frondI);
    // round trees
    if (trees.length) {
      const tI = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.25, 0.35, 3, 6).translate(0, 1.5, 0), new THREE.MeshLambertMaterial({ color: 0x5b3a1e }), trees.length);
      const cI = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(2.4, 1).translate(0, 4.4, 0), new THREE.MeshLambertMaterial({ color: 0x2f8f3f }), trees.length);
      trees.forEach((t, i) => { dummy.position.set(t.x * K, 0, t.y * K); dummy.rotation.set(0, 0, 0); dummy.scale.setScalar(0.8 + t.k * 0.5); dummy.updateMatrix(); tI.setMatrixAt(i, dummy.matrix); cI.setMatrixAt(i, dummy.matrix); });
      cityGroup.add(tI, cI);
    }
    // lamps
    const poleI = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.1, 0.12, 5.2, 6).translate(0, 2.6, 0), new THREE.MeshLambertMaterial({ color: 0x2c2c34 }), lamps.length);
    const lp = new Float32Array(lamps.length * 3);
    lamps.forEach((l, i) => { dummy.position.set(l.x * K, 0, l.y * K); dummy.rotation.set(0, 0, 0); dummy.scale.setScalar(1); dummy.updateMatrix(); poleI.setMatrixAt(i, dummy.matrix); lp[i * 3] = l.x * K; lp[i * 3 + 1] = 5.3; lp[i * 3 + 2] = l.y * K; });
    cityGroup.add(poleI);
    const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.BufferAttribute(lp, 3));
    glowPts = new THREE.Points(gg, new THREE.PointsMaterial({ map: radial([[0, 'rgba(255,225,170,1)'], [0.3, 'rgba(255,200,120,.45)'], [1, 'rgba(255,190,100,0)']]), size: 9, sizeAttenuation: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0, fog: false }));
    glowPts.frustumCulled = false; cityGroup.add(glowPts);
  }

  // ------------------------------------------------------------------ markers
  function buildMarkers() {
    const mk = () => {
      const g = new THREE.Group();
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.88, 1, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
      const disc = new THREE.Mesh(new THREE.CircleGeometry(1, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 40, 24, 1, true).translate(0, 20, 0), new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
      ring.position.y = disc.position.y = 0.06; g.add(ring, disc, beam); g.userData = { ring, disc, beam }; g.visible = false; cityGroup.add(g); return g;
    };
    for (let i = 0; i < 6; i++) markerPool.push(mk());
    for (const k in World.POI) { const m = mk(); const p = World.POI[k]; m.userData.beam.visible = false; m.userData.ring.material.color.set(p.col); m.userData.disc.material.color.set(p.col); m.position.set(p.x * K, 0, p.y * K); m.scale.set(1.9, 1, 1.9); m.visible = k !== 'og' && k !== 'stash'; m.userData.poi = k; poiRings.push(m); }
  }
  function setMarkers(list, t) {
    markerPool.forEach((g, i) => {
      const m = list[i]; if (!m) { g.visible = false; return; }
      g.visible = true; const r = Math.max(1.5, Math.min(m.r || 60, 90) * K); g.position.set(m.x * K, 0, m.y * K); g.scale.set(r, 1, r);
      const c = new THREE.Color(m.col); for (const k of ['ring', 'disc', 'beam']) g.userData[k].material.color.copy(c);
      g.userData.ring.material.opacity = 0.6 + 0.35 * Math.sin(t * 4); g.userData.beam.scale.set(0.35, 1, 0.35);
    });
    for (const g of poiRings) { const k = g.userData.poi; g.visible = !(k === 'og' || (k === 'stash')) && !intGroup; }
  }

  // ------------------------------------------------------------------ fx sprites (smoke, fire, sparks)
  let smokeTex, fireTex;
  function buildFx() {
    smokeTex = radial([[0, 'rgba(60,60,60,.7)'], [1, 'rgba(60,60,60,0)']]); fireTex = radial([[0, 'rgba(255,240,160,1)'], [0.4, 'rgba(255,140,40,.8)'], [1, 'rgba(255,60,0,0)']]);
    for (let i = 0; i < 140; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTex, transparent: true, depthWrite: false })); s.visible = false; cityGroup.add(s); fxSprites.push(s); }
    for (let i = 0; i < 8; i++) { const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 0, 1)]), new THREE.LineBasicMaterial({ color: 0xffe9a0, transparent: true, fog: false })); l.visible = false; l.frustumCulled = false; scene.add(l); tracers.push({ l, t: 0 }); }
  }
  function syncFx(fx) {
    let n = 0;
    for (const f of fx) {
      if (f.t === 'txt' || f.t === 'ring') continue; if (n >= fxSprites.length) break;
      const s = fxSprites[n++], a = Math.max(0, f.life / f.max); s.visible = true;
      s.position.set(f.x * K, 1.2 + (1 - a) * (f.t === 'smoke' ? 3.5 : 1.5), f.y * K);
      if (f.t === 'smoke') { s.material.map = smokeTex; s.material.opacity = 0.7 * a; s.scale.setScalar(f.r * K * 3.2); s.material.blending = THREE.NormalBlending; s.material.color.setRGB(f.col / 90, f.col / 90, f.col / 90); }
      else if (f.t === 'fire') { s.material.map = fireTex; s.material.opacity = a; s.scale.setScalar(f.r * K * 3.5); s.material.blending = THREE.AdditiveBlending; s.material.color.setRGB(1, 1, 1); }
      else { s.material.map = fireTex; s.material.opacity = a; s.scale.setScalar(0.5); s.material.blending = THREE.AdditiveBlending; s.material.color.setRGB(1, 1, 1); }
    }
    for (; n < fxSprites.length; n++) fxSprites[n].visible = false;
  }
  function tracer(x0, y0, x1, y1, h) {
    const t = tracers.find(q => q.t <= 0) || tracers[0]; t.t = 0.09;
    const p = t.l.geometry.attributes.position; p.setXYZ(0, x0 * K, h || 1.5, y0 * K); p.setXYZ(1, x1 * K, h || 1.5, y1 * K); p.needsUpdate = true; t.l.visible = true;
  }

  // ------------------------------------------------------------------ cars
  const shadowTex = () => radial([[0, 'rgba(0,0,0,.65)'], [0.6, 'rgba(0,0,0,.35)'], [1, 'rgba(0,0,0,0)']], 64);
  let shadowT = null; const carViews = new Map();
  const glass = new THREE.MeshLambertMaterial({ color: 0x1b2a3c, emissive: 0x050a12 }), blackM = new THREE.MeshLambertMaterial({ color: 0x0b0b0f });
  const headM = new THREE.MeshBasicMaterial({ color: 0xfff2c0 }), tailOn = new THREE.MeshBasicMaterial({ color: 0xff2a2a }), tailOff = new THREE.MeshBasicMaterial({ color: 0x8a1818 }), whiteM = new THREE.MeshLambertMaterial({ color: 0xf1f1f4 });
  const sirenR = [new THREE.MeshBasicMaterial({ color: 0xff2020 }), new THREE.MeshBasicMaterial({ color: 0x401010 })], sirenB = [new THREE.MeshBasicMaterial({ color: 0x2040ff }), new THREE.MeshBasicMaterial({ color: 0x101040 })];
  const wheelG = {}, lightG = {};
  function carMesh(c) {
    if (!shadowT) shadowT = shadowTex();
    const L = c.len * K, Wd = c.wid * K, t = c.type, g = new THREE.Group(), inner = new THREE.Group(); g.add(inner);
    const bodyM = new THREE.MeshLambertMaterial({ color: c.color }), low = t === 'sport', van = t === 'van';
    const bh = low ? 0.8 : 0.95, by = 0.28 + bh / 2;
    const body = new THREE.Mesh(new THREE.BoxGeometry(L, bh, Wd), bodyM); body.position.y = by; inner.add(body);
    const cl = van ? L * 0.74 : L * (low ? 0.42 : 0.5), ch = van ? 1.25 : low ? 0.62 : 0.8, cy = by + bh / 2 + ch / 2;
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(cl, ch, Wd * 0.88), [glass, glass, bodyM, glass, glass, glass]); cabin.position.set(van ? -L * 0.1 : -L * 0.06, cy, 0); inner.add(cabin);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(cl + 0.12, 0.1, Wd * 0.88 + 0.1), bodyM); roof.position.set(cabin.position.x, cy + ch / 2, 0); inner.add(roof);
    for (const s of [-1, 1]) { const bm = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.38, Wd + 0.08), blackM); bm.position.set(s * L / 2, 0.5, 0); inner.add(bm); }
    const key = L.toFixed(1) + '_' + Wd.toFixed(1);
    if (!wheelG[key]) {
      const ws = []; for (const sx of [-0.31, 0.31]) for (const sz of [-1, 1]) ws.push(new THREE.CylinderGeometry(0.4, 0.4, 0.34, 12).rotateX(Math.PI / 2).translate(sx * L, 0.4, sz * (Wd / 2 - 0.02)));
      wheelG[key] = mergeGeos(ws);
      const hs = []; for (const sz of [-1, 1]) hs.push(new THREE.BoxGeometry(0.12, 0.26, 0.5).translate(L / 2 + 0.02, by + 0.1, sz * Wd * 0.34)); lightG[key + 'h'] = mergeGeos(hs);
      const ts = []; for (const sz of [-1, 1]) ts.push(new THREE.BoxGeometry(0.12, 0.26, 0.55).translate(-L / 2 - 0.02, by + 0.1, sz * Wd * 0.34)); lightG[key + 't'] = mergeGeos(ts);
    }
    inner.add(new THREE.Mesh(wheelG[key], blackM)); inner.add(new THREE.Mesh(lightG[key + 'h'], headM));
    const tail = new THREE.Mesh(lightG[key + 't'], tailOff); inner.add(tail);
    const v = { g, inner, tail, bodyM, c, L, Wd };
    if (t === 'police') {
      for (const s of [-1, 1]) { const d = new THREE.Mesh(new THREE.BoxGeometry(L * 0.3, bh * 0.72, Wd + 0.05), whiteM); d.position.set(0, by, 0); if (s > 0) inner.add(d); }
      v.sr = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.2, Wd * 0.34), sirenR[0]); v.sb = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.2, Wd * 0.34), sirenB[1]);
      v.sr.position.set(cabin.position.x, cy + ch / 2 + 0.18, -Wd * 0.2); v.sb.position.set(cabin.position.x, cy + ch / 2 + 0.18, Wd * 0.2); inner.add(v.sr, v.sb);
    }
    if (t === 'taxi') { const s = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.25, 0.9), new THREE.MeshBasicMaterial({ color: 0xfff6c0 })); s.position.set(cabin.position.x, cy + ch / 2 + 0.2, 0); inner.add(s); }
    if (t === 'lowrider') { const gl = new THREE.Mesh(new THREE.PlaneGeometry(L * 1.15, Wd * 1.25).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xff4fd8, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false })); gl.position.y = 0.1; g.add(gl); v.glow = gl; }
    const sh = new THREE.Mesh(new THREE.PlaneGeometry(L * 1.35, Wd * 1.4).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: shadowT, transparent: true, depthWrite: false })); sh.position.y = 0.04; g.add(sh);
    cityGroup.add(g); return v;
  }
  function syncCars(cars, time) {
    const seen = new Set();
    for (const c of cars) {
      let v = carViews.get(c); if (!v) { v = carMesh(c); carViews.set(c, v); }
      seen.add(c);
      v.g.position.set(c.x * K, 0, c.y * K); v.g.rotation.y = -c.a;
      const sp = c.speedF || 0, wob = c.type === 'lowrider' && !c.wreck ? Math.sin(time * 2 + c.x) * 0.03 : 0;
      v.inner.rotation.x = clamp(-c.av * sp * 0.00055, -0.09, 0.09); v.inner.rotation.z = clamp(-(c.thr - c.brake) * 0.018 * Math.min(1, Math.abs(sp) / 150), -0.04, 0.04); v.inner.position.y = wob;
      v.tail.material = (c.brake > 0.2 || sp < -5) && !c.wreck ? tailOn : tailOff;
      if (c.wreck && !v.wrecked) { v.wrecked = true; v.bodyM.color.set(0x161616); }
      if (c.type === 'police' && v.sr) { const f = Math.floor(time * 8) % 2; v.sr.material = sirenR[f]; v.sb.material = sirenB[1 - f]; }
      if (v.glow) v.glow.material.opacity = 0.3 + 0.2 * Math.sin(time * 3 + c.x);
    }
    for (const [c, v] of carViews) if (!seen.has(c)) { cityGroup.remove(v.g); v.g.traverse(o => { if (o.isMesh && o.material && o.material.userData && o.material.userData.own) o.material.dispose(); }); carViews.delete(c); }
  }

  // ------------------------------------------------------------------ billboard characters
  const FW = 128, FH = 192, COLS = 4, ROWS = 7;
  const bank = new Map();
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
        if (f.gun === 2) { x.fillStyle = '#ffe27a'; x.beginPath(); x.moveTo(gx + 25, gy2 - 1); x.lineTo(gx + 40, gy2 - 10); x.lineTo(gx + 36, gy2 - 1); x.lineTo(gx + 42, gy2 + 8); x.closePath(); x.fill(); x.fillStyle = '#fff'; x.fillRect(gx + 25, gy2 - 3, 10, 4); }
      }
      x.restore();
    });
    const t = new THREE.CanvasTexture(c); t.minFilter = THREE.LinearFilter; t.magFilter = THREE.LinearFilter; t.generateMipmaps = false;
    const set = { tex: t }; bank.set(key, set); return set;
  }
  const pedGeo = new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0);
  const pedViews = new Map(), tint = new THREE.Color(1, 1, 1);
  const PH = 2.15, PW = PH * FW / FH;
  function makeView(p, parent) {
    const set = spriteSet(p.char, p.hue), t = set.tex.clone(); t.needsUpdate = true; t.repeat.set(1 / COLS, 1 / ROWS);
    const mat = new THREE.MeshBasicMaterial({ map: t, transparent: true, alphaTest: 0.3, side: THREE.DoubleSide });
    const m = new THREE.Mesh(pedGeo, mat); m.scale.set(PW, PH, 1);
    const grp = new THREE.Group(); grp.add(m);
    if (!shadowT) shadowT = shadowTex();
    const sh = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: shadowT, transparent: true, depthWrite: false })); sh.position.y = 0.04; grp.add(sh);
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
  function syncPeds(peds, yaw, time, lightCol) {
    const seen = new Set(), rx = -Math.sin(yaw), rz = Math.cos(yaw), th = Math.atan2(-Math.cos(yaw), -Math.sin(yaw));
    for (const p of peds) {
      let v = pedViews.get(p); if (!v || v.key !== p.char + ':' + p.hue) { if (v) { cityGroup.remove(v.grp); } v = makeView(p); pedViews.set(p, v); }
      seen.add(p); if (p.hidden) { v.grp.visible = false; continue; } v.grp.visible = true;
      v.grp.position.set(p.x * K, 0, p.y * K); v.m.rotation.y = th;
      const hx = p.hx === undefined ? 1 : p.hx, hz = p.hy === undefined ? 0 : p.hy, d = hx * rx + hz * rz; if (Math.abs(d) > 0.12) v.fx = d > 0 ? 1 : -1;
      v.m.scale.x = PW * v.fx; setFrame(v, pickFrame(p, time));
      v.mat.color.copy(lightCol); if (p.flash > 0) v.mat.color.setRGB(2.2, 1.6, 1.6);
      if (p.dead) v.grp.children[1].material.opacity = 1;
    }
    for (const [p, v] of pedViews) if (!seen.has(p)) { cityGroup.remove(v.grp); v.mat.dispose(); v.t.dispose(); pedViews.delete(p); }
  }

  // ------------------------------------------------------------------ interior hook, camera, render
  function setInterior(g) {
    if (intGroup) scene.remove(intGroup);
    intGroup = g; cityGroup.visible = !g; skyMesh.visible = !g; starPts.visible = !g;
    if (g) { scene.add(g); scene.fog.color.set(0x14091f); scene.fog.near = 30; scene.fog.far = 90; } else { scene.fog.near = 50; scene.fog.far = 250; }
  }
  function setCamera(px, py, pz, tx, ty, tz, fov) {
    camera.position.set(px, py, pz); camera.lookAt(tx, ty, tz); if (fov && Math.abs(camera.fov - fov) > 0.05) { camera.fov = fov; camera.updateProjectionMatrix(); }
    skyMesh.position.copy(camera.position); starPts.position.copy(camera.position);
    const a = sunSprite.userData.ang || 0; sunSprite.position.set(camera.position.x + Math.cos(a) * 330 * -1 * 0 - 120, camera.position.y + Math.sin(a) * 280 + 6, camera.position.z - 330 * Math.cos(a) * 0 - 300 + 0);
    sunSprite.position.set(camera.position.x - Math.cos(a) * 300, camera.position.y + Math.sin(a) * 260, camera.position.z - 120);
  }
  function project(x, y, h, w, hh) {
    const v = new THREE.Vector3(x * K, h, y * K).project(camera); return { x: (v.x * 0.5 + 0.5) * w, y: (-v.y * 0.5 + 0.5) * hh, vis: v.z < 1 && v.z > -1 };
  }
  function update(dt) { for (const t of tracers) { if (t.t > 0) { t.t -= dt; t.l.material.opacity = Math.max(0, t.t / 0.09); if (t.t <= 0) t.l.visible = false; } } }
  function render() { renderer.render(scene, camera); }
  return { K, init, resize, setTime, billboard, pickFrame, syncCars, syncPeds, syncFx, setMarkers, setInterior, setCamera, project, tracer, update, render, spriteSet, tex, radial, mergeGeos,
    get scene() { return scene; }, get camera() { return camera; }, get renderer() { return renderer; }, carViews, pedViews, shadowTex: () => shadowT || (shadowT = shadowTex()) };
})();
