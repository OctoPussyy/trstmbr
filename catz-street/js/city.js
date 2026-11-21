// Builds the photoreal city: PBR ground, raised sidewalks with curbs, road paint, detailed procedural buildings
// (framed windows, storefronts, awnings, neon signs, fire escapes, roof units, billboards), streetlights, traffic signals, props.
const City = (() => {
  const { R, P, N, B, SW, SIZE, DX, DY } = World;
  let K = 1 / 20;
  const H0 = 0.15;                     // sidewalk height
  const CH = 2, NC = Math.ceil(N / CH); // 2x2 blocks per render chunk
  const WHITE = [1, 1, 1], UP = [0, 1, 0];
  const nightMats = [];
  function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  const hexRGB = h => { const n = parseInt(h.slice(1), 16); return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; };
  const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const neg = a => [-a[0], -a[1], -a[2]];

  // ---------------------------------------------------------------- geometry builder
  class Bucket {
    constructor() { this.p = []; this.n = []; this.u = []; this.c = []; this.i = []; }
    face(c, n, b, hw, hh, uv, col) {
      const t = cross(b, n), base = this.p.length / 3, cc = col || WHITE;
      for (const [s, r] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { this.p.push(c[0] + t[0] * hw * s + b[0] * hh * r, c[1] + t[1] * hw * s + b[1] * hh * r, c[2] + t[2] * hw * s + b[2] * hh * r); this.n.push(n[0], n[1], n[2]); this.c.push(cc[0], cc[1], cc[2]); }
      if (typeof uv === 'number') { const uc = dot(c, t) / uv, vc = dot(c, b) / uv; uv = [uc - hw / uv, vc - hh / uv, uc + hw / uv, vc + hh / uv]; } else if (!uv) uv = [0, 0, 1, 1];
      this.u.push(uv[0], uv[1], uv[2], uv[1], uv[2], uv[3], uv[0], uv[3]);
      this.i.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
    // oriented box: centre c, unit axes X Y Z, half sizes; mask skips faces (+X,-X,+Y,-Y,+Z,-Z)
    obox(c, X, Y, Z, hx, hy, hz, col, tile, mask) {
      const F = [[X, Y, hz, hy, hx], [neg(X), Y, hz, hy, hx], [Y, neg(Z), hx, hz, hy], [neg(Y), Z, hx, hz, hy], [Z, Y, hx, hy, hz], [neg(Z), Y, hx, hy, hz]];
      F.forEach(([n, b, hw, hh, off], k) => { if (mask && !(mask & (1 << k))) return; this.face([c[0] + n[0] * off, c[1] + n[1] * off, c[2] + n[2] * off], n, b, hw, hh, tile, col); });
    }
    box(cx, cy, cz, sx, sy, sz, col, tile, mask) { this.obox([cx, cy, cz], [1, 0, 0], [0, 1, 0], [0, 0, 1], sx / 2, sy / 2, sz / 2, col, tile, mask); }
    cyl(cx, cy, cz, r, h, seg, col, cap) {
      for (let s = 0; s < seg; s++) {
        const a0 = s / seg * Math.PI * 2, a1 = (s + 1) / seg * Math.PI * 2, am = (a0 + a1) / 2, n = [Math.cos(am), 0, Math.sin(am)];
        const w = r * Math.sin(Math.PI / seg); this.face([cx + Math.cos(am) * r * Math.cos(Math.PI / seg), cy + h / 2, cz + Math.sin(am) * r * Math.cos(Math.PI / seg)], n, UP, w, h / 2, [s / seg, 0, (s + 1) / seg, 1], col);
      }
      if (cap !== false) { const base = this.p.length / 3; this.p.push(cx, cy + h, cz); this.n.push(0, 1, 0); this.u.push(0.5, 0.5); const cc = col || WHITE; this.c.push(...cc);
        for (let s = 0; s <= seg; s++) { const a = s / seg * Math.PI * 2; this.p.push(cx + Math.cos(a) * r, cy + h, cz + Math.sin(a) * r); this.n.push(0, 1, 0); this.u.push(0.5 + Math.cos(a) / 2, 0.5 + Math.sin(a) / 2); this.c.push(...cc); }
        for (let s = 0; s < seg; s++) this.i.push(base, base + 2 + s, base + 1 + s); }
    }
    geometry() {
      if (!this.i.length) return null;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(this.u, 2)); g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
      g.setIndex(this.p.length / 3 > 65535 ? new THREE.Uint32BufferAttribute(this.i, 1) : new THREE.Uint16BufferAttribute(this.i, 1)); g.computeBoundingSphere(); return g;
    }
  }

  // ---------------------------------------------------------------- canvas atlases (windows, storefronts, signs, billboards)
  const canvasTex = (w, h, draw, srgb = true) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.anisotropy = 8; return t; };
  function windowAtlas() {   // 4x4 lit interiors seen through a window
    return canvasTex(512, 512, (x) => {
      const R2 = mulberry(77);
      for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) {
        const ox = i * 128, oy = j * 128, warm = R2() < 0.75;
        const g = x.createLinearGradient(ox, oy, ox, oy + 128); g.addColorStop(0, warm ? '#ffd9a0' : '#cfe6ff'); g.addColorStop(1, warm ? '#c9874a' : '#7ea2c9'); x.fillStyle = g; x.fillRect(ox, oy, 128, 128);
        const kind = (i + j * 4) % 4;
        if (kind === 0) { x.fillStyle = 'rgba(120,30,40,.55)'; x.fillRect(ox, oy, 34, 128); x.fillRect(ox + 94, oy, 34, 128); }
        if (kind === 1) { x.fillStyle = 'rgba(255,255,255,.35)'; for (let k = 0; k < 12; k++) x.fillRect(ox, oy + k * 11, 128, 5); }
        if (kind === 2) { x.fillStyle = 'rgba(40,25,20,.6)'; x.fillRect(ox + 20, oy + 70, 60, 58); x.beginPath(); x.arc(ox + 90, oy + 60, 14, 0, 7); x.fill(); }
        if (kind === 3) { x.fillStyle = 'rgba(255,240,200,.8)'; x.beginPath(); x.arc(ox + 64, oy + 20, 10, 0, 7); x.fill(); x.fillStyle = 'rgba(60,40,30,.5)'; x.fillRect(ox + 10, oy + 96, 108, 32); }
        x.fillStyle = 'rgba(0,0,0,.25)'; x.fillRect(ox + 62, oy, 4, 128);
      }
    });
  }
  function storeAtlas() {    // 4x2 shop interiors
    return canvasTex(1024, 256, (x) => {
      const pal = ['#ffd23f', '#ff4fd8', '#3ec8ff', '#3ef2a0', '#ff9a3c', '#c78bff', '#ff3860', '#ffffff'];
      for (let k = 0; k < 8; k++) {
        const ox = (k % 4) * 256, oy = Math.floor(k / 4) * 128, g = x.createLinearGradient(ox, oy, ox, oy + 128);
        g.addColorStop(0, '#fff1d6'); g.addColorStop(1, '#8a6a4a'); x.fillStyle = g; x.fillRect(ox, oy, 256, 128);
        for (let s = 0; s < 3; s++) { x.fillStyle = '#5a4030'; x.fillRect(ox + 6, oy + 30 + s * 30, 244, 4); for (let i = 0; i < 22; i++) { x.fillStyle = pal[(i * 7 + s * 3 + k) % pal.length]; x.fillRect(ox + 8 + i * 11, oy + 14 + s * 30, 8, 16); } }
        x.fillStyle = 'rgba(20,10,10,.55)'; x.fillRect(ox + 150 + (k * 13) % 60, oy + 50, 22, 78); x.beginPath(); x.arc(ox + 161 + (k * 13) % 60, oy + 44, 10, 0, 7); x.fill();
        x.fillStyle = pal[k]; x.font = '900 18px Arial'; x.fillText(['OPEN', '24H', 'SALE', 'ATM', 'LOTTO', 'COLD BEER', 'OPEN', 'WIC'][k], ox + 12, oy + 122);
      }
    });
  }
  let signCells = {};
  function signAtlas(signs) {
    const names = [...new Set(signs.map(s => s.text + '|' + s.col))], cols = 2, rows = Math.ceil(names.length / cols);
    const t = canvasTex(1024, rows * 128, (x) => {
      names.forEach((key, i) => {
        const [text, col] = key.split('|'), ox = (i % cols) * 512, oy = Math.floor(i / cols) * 128;
        x.fillStyle = '#07060c'; x.fillRect(ox, oy, 512, 128); x.strokeStyle = col; x.lineWidth = 6; x.shadowColor = col; x.shadowBlur = 14; x.strokeRect(ox + 10, oy + 10, 492, 108);
        let fs = 74; x.font = `900 ${fs}px "Arial Black", Impact, sans-serif`; while (x.measureText(text).width > 450 && fs > 24) { fs -= 4; x.font = `900 ${fs}px "Arial Black", Impact, sans-serif`; }
        x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = '#ffffff'; x.shadowBlur = 22; x.fillText(text, ox + 256, oy + 68); x.fillStyle = col; x.shadowBlur = 0; x.globalAlpha = 0.55; x.fillText(text, ox + 256, oy + 68); x.globalAlpha = 1;
        signCells[key] = [(i % cols) / cols, 1 - (Math.floor(i / cols) + 1) / rows, (i % cols + 1) / cols, 1 - Math.floor(i / cols) / rows];
      });
    });
    return t;
  }
  function billboardAtlas() {
    const ads = [['CATZ COLA', 'Taste the purr.', '#e11d48', '#fde68a'], ['WKAT 90.9', 'Boom bap all night', '#1e1b4b', '#ff4fd8'], ['TRUST ME BRO', 'Five spins. No regrets.', '#065f46', '#fde047'], ['LOWRIDERZ AUTO', 'Hydraulics · Candy paint', '#7c2d12', '#38bdf8']];
    return canvasTex(1024, 512, (x) => {
      ads.forEach(([a, b, bg, fg], i) => {
        const ox = (i % 2) * 512, oy = Math.floor(i / 2) * 256, g = x.createLinearGradient(ox, oy, ox + 512, oy + 256); g.addColorStop(0, bg); g.addColorStop(1, '#000');
        x.fillStyle = g; x.fillRect(ox, oy, 512, 256); x.fillStyle = fg; x.font = 'italic 900 64px "Arial Black", Impact, sans-serif'; x.textAlign = 'left'; x.fillText(a, ox + 24, oy + 120, 470);
        x.fillStyle = '#fff'; x.font = '700 30px Arial'; x.fillText(b, ox + 28, oy + 176, 460); x.fillStyle = fg; x.fillRect(ox + 24, oy + 196, 120, 8);
      });
    });
  }
  function towerTex(lit) {   // 8 bays x 8 floors of curtain wall
    return canvasTex(512, 512, (x, w, h) => {
      const R2 = mulberry(lit ? 9 : 5);
      x.fillStyle = lit ? '#000' : '#1d3346'; x.fillRect(0, 0, w, h);
      for (let j = 0; j < 8; j++) for (let i = 0; i < 8; i++) {
        const ox = i * 64, oy = j * 64;
        if (lit) { if (R2() < 0.42) { x.fillStyle = R2() < 0.7 ? '#ffe2b0' : '#d8ecff'; x.fillRect(ox + 3, oy + 12, 58, 50); } continue; }
        const g = x.createLinearGradient(ox, oy, ox + 64, oy + 64); g.addColorStop(0, '#3d6a8c'); g.addColorStop(1, '#16283a'); x.fillStyle = g; x.fillRect(ox + 3, oy + 12, 58, 50);
        x.fillStyle = '#8fa3b3'; x.fillRect(ox, oy, 64, 10);
      }
      if (!lit) { x.fillStyle = '#9fb1c0'; for (let i = 0; i <= 8; i++) x.fillRect(i * 64 - 1, 0, 3, h); }
    }, !lit ? true : true);
  }
  function stripeTex() { return canvasTex(128, 128, (x) => { for (let i = 0; i < 8; i++) { x.fillStyle = i % 2 ? '#ffffff' : '#d9d9d9'; x.fillRect(i * 16, 0, 16, 128); } x.fillStyle = 'rgba(0,0,0,.08)'; x.fillRect(0, 110, 128, 18); }); }
  function grassTex() { return canvasTex(256, 256, (x) => { x.fillStyle = '#4c7d32'; x.fillRect(0, 0, 256, 256); const R2 = mulberry(3); for (let i = 0; i < 5000; i++) { x.fillStyle = `hsl(${85 + R2() * 30},${40 + R2() * 25}%,${22 + R2() * 22}%)`; x.fillRect(R2() * 256, R2() * 256, 1.5, 3 + R2() * 4); } }); }
  function frondTex() {
    return canvasTex(512, 128, (x, w, h) => {
      x.clearRect(0, 0, w, h); x.strokeStyle = '#3d5a1f'; x.lineWidth = 5; x.beginPath(); x.moveTo(0, h / 2); x.lineTo(w, h / 2); x.stroke();
      for (let i = 4; i < w - 6; i += 7) {
        const len = 58 * Math.sin(Math.PI * Math.min(1, i / w * 1.15)) + 6;
        for (const s of [-1, 1]) { const g = x.createLinearGradient(i, h / 2, i + 18, h / 2 + s * len); g.addColorStop(0, '#2f6b1f'); g.addColorStop(1, '#78a83a'); x.strokeStyle = g; x.lineWidth = 4; x.beginPath(); x.moveTo(i, h / 2); x.quadraticCurveTo(i + 10, h / 2 + s * len * 0.5, i + 22, h / 2 + s * len); x.stroke(); }
      }
    });
  }
  function leafTex() {
    return canvasTex(256, 256, (x) => { const R2 = mulberry(21); x.fillStyle = '#21431a'; x.globalAlpha = 1;
      for (let i = 0; i < 260; i++) { const px = 20 + R2() * 216, py = 20 + R2() * 216, a = R2() * 6.28, l = 10 + R2() * 12; x.save(); x.translate(px, py); x.rotate(a); x.fillStyle = `hsl(${88 + R2() * 30},${38 + R2() * 25}%,${20 + R2() * 22}%)`; x.beginPath(); x.ellipse(0, 0, l, l * 0.42, 0, 0, 7); x.fill(); x.restore(); } });
  }
  const radialTex = (inner, outer) => canvasTex(128, 128, (x, w) => { const g = x.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, inner); g.addColorStop(1, outer); x.fillStyle = g; x.fillRect(0, 0, w, w); });

  // ---------------------------------------------------------------- materials
  let M = {};
  function std(o, night) { const m = new THREE.MeshStandardMaterial(o); if (night) { m.userData.night = night; nightMats.push(m); } return m; }
  function texMat(set, o) { const t = Assets.tex[set]; return std(Object.assign({ map: t.map, normalMap: t.normal, roughnessMap: t.arm, metalnessMap: null, roughness: 1, metalness: 0 }, o || {})); }
  // breaks up texture tiling on big surfaces and draws sidewalk slab joints
  function detailShader(m, joints) {
    m.onBeforeCompile = sh => {
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP;').replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWP = (modelMatrix * vec4(transformed,1.0)).xyz;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP;\nfloat hsh(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}\nfloat vn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hsh(i),hsh(i+vec2(1,0)),f.x),mix(hsh(i+vec2(0,1)),hsh(i+vec2(1,1)),f.x),f.y);}')
        .replace('#include <map_fragment>', `#include <map_fragment>
          float macro = vn(vWP.xz * 0.06) * 0.6 + vn(vWP.xz * 0.21) * 0.4;
          diffuseColor.rgb *= mix(0.82, 1.12, macro);
          ${joints ? 'vec2 jg = abs(fract(vWP.xz / 1.8 + 0.5) - 0.5) * 1.8; float jl = 1.0 - smoothstep(0.0, 0.025, min(jg.x, jg.y)); diffuseColor.rgb *= 1.0 - jl * 0.45;' : ''}`);
    };
  }
  function makeMaterials() {
    const T = Assets.tex;
    M.road = texMat('road', { roughness: 1 }); detailShader(M.road, false);
    M.sidewalk = texMat('sidewalk'); detailShader(M.sidewalk, true);
    M.curb = texMat('curb', { color: 0xc8c4bc });
    M.pavers = texMat('pavers', { color: 0xb5ada3 }); detailShader(M.pavers, false);
    M.sand = texMat('sand', { color: 0xf1dcae }); detailShader(M.sand, false);
    M.grass = std({ map: grassTex(), roughness: 0.95 }); M.grass.map.wrapS = M.grass.map.wrapT = THREE.RepeatWrapping; detailShader(M.grass, false);
    M.plaster = texMat('plaster', { vertexColors: true });
    M.brick = texMat('brick', { vertexColors: true });
    M.concrete = texMat('concrete', { vertexColors: true });
    M.roof = texMat('roof', { color: 0x8a8a8a });
    M.trim = texMat('plaster', { vertexColors: true, roughness: 0.85 });
    M.metal = std({ color: 0x2a2c31, roughness: 0.45, metalness: 0.75, vertexColors: true });
    M.frame = std({ color: 0xffffff, roughness: 0.4, metalness: 0.3, vertexColors: true });
    M.glass = std({ color: 0x0d151d, roughness: 0.05, metalness: 0.9 });
    M.glassLit = std({ map: windowAtlas(), emissive: 0xffffff, emissiveMap: null, roughness: 0.15, metalness: 0.2 }, { base: 0.08, night: 1.6 }); M.glassLit.emissiveMap = M.glassLit.map;
    M.store = std({ map: storeAtlas(), emissive: 0xffffff, roughness: 0.1, metalness: 0.3 }, { base: 0.5, night: 2.6 }); M.store.emissiveMap = M.store.map;
    M.fabric = std({ map: stripeTex(), vertexColors: true, roughness: 0.9, side: THREE.DoubleSide });
    M.paint = std({ vertexColors: true, roughness: 0.65, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    M.tower = std({ map: towerTex(false), roughness: 0.06, metalness: 0.85, emissive: 0xffffff }, { base: 0.0, night: 1.4 }); M.tower.emissiveMap = towerTex(true); M.tower.map.wrapS = M.tower.map.wrapT = M.tower.emissiveMap.wrapS = M.tower.emissiveMap.wrapT = THREE.RepeatWrapping;
    M.billboard = std({ map: billboardAtlas(), emissive: 0xffffff, roughness: 0.6 }, { base: 0.15, night: 1.2 }); M.billboard.emissiveMap = M.billboard.map;
    M.lens = new THREE.MeshBasicMaterial({ color: 0xffffff });
    M.pool = new THREE.MeshBasicMaterial({ map: radialTex('rgba(255,214,160,.85)', 'rgba(255,190,120,0)'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 });
    M.water = std({ color: 0x0d4f6a, roughness: 0.04, metalness: 0.1 });
    M.bark = texMat('bark', { color: 0x9a8064 });
    M.frond = std({ map: frondTex(), alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.75 });
    M.leaf = std({ map: leafTex(), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.8 });
  }

  // ---------------------------------------------------------------- chunks
  const chunks = [];
  function chunkFor(i, j) { return chunks[Math.min(NC - 1, Math.floor(j / CH)) * NC + Math.min(NC - 1, Math.floor(i / CH))]; }
  function newChunk(idx) { const ci = idx % NC, cj = Math.floor(idx / NC); return { b: {}, group: new THREE.Group(), cx: ((ci * CH + CH / 2) * P + R / 2) * K, cz: ((cj * CH + CH / 2) * P + R / 2) * K }; }
  function chunkAtM(x, z) { return chunkFor(Math.max(0, Math.min(N - 1, Math.floor((x / K - R) / P))), Math.max(0, Math.min(N - 1, Math.floor((z / K - R) / P)))); }
  function byChunk(list, getXZ) { const m = new Map(); for (const q of list) { const [x, z] = getXZ(q), ch = chunkAtM(x, z); if (!m.has(ch)) m.set(ch, []); m.get(ch).push(q); } return m; }
  function cull(x, z) { for (const ch of chunks) ch.group.visible = Math.hypot(ch.cx - x, ch.cz - z) - 46 < 235; }
  const bk = (ch, name) => ch.b[name] || (ch.b[name] = new Bucket());

  // ---------------------------------------------------------------- ground, curbs, paint
  function buildGround(root) {
    const S = SIZE * K, gb = new Bucket();
    gb.face([S / 2, 0, S / 2], UP, [0, 0, -1], S / 2, S / 2, 5);
    const road = new THREE.Mesh(gb.geometry(), M.road); road.receiveShadow = true; root.add(road);
    const sb = new Bucket(); const E = 70;
    for (const [cx, cz, hw, hh] of [[S / 2, -E / 2, S / 2 + E, E / 2], [S / 2, S + E / 2, S / 2 + E, E / 2], [-E / 2, S / 2, E / 2, S / 2], [S + E / 2, S / 2, E / 2, S / 2]]) sb.face([cx, -0.02, cz], UP, [0, 0, -1], hw, hh, 6);
    const sand = new THREE.Mesh(sb.geometry(), M.sand); sand.receiveShadow = true; root.add(sand);
    const wb = new Bucket(); wb.face([S / 2, -0.35, S / 2], UP, [0, 0, -1], S / 2 + 900, S / 2 + 900, 0); const sea = new THREE.Mesh(wb.geometry(), M.water); root.add(sea);
    // road paint
    const pb = new Bucket(), Y = [0.93, 0.72, 0.16], Wt = [0.92, 0.92, 0.9];
    const line = (x0, z0, x1, z1, w, col) => { const dx = x1 - x0, dz = z1 - z0, l = Math.hypot(dx, dz); pb.face([(x0 + x1) / 2, 0.012, (z0 + z1) / 2], UP, [-dx / l, 0, -dz / l].map((v, k) => k === 1 ? 0 : v), w / 2, l / 2, null, col); };
    for (let k = 0; k <= N; k++) {
      const c = (k * P + R / 2) * K;
      for (let s = 0; s < N; s++) {
        const a = (s * P + R) * K + 0.5, e = ((s + 1) * P) * K - 0.5;
        for (const o of [-0.12, 0.12]) { line(c + o, a, c + o, e, 0.1, Y); line(a, c + o, e, c + o, 0.1, Y); }
        for (const o of [-R / 2 * K + 0.35, R / 2 * K - 0.35]) { line(c + o, a, c + o, e, 0.12, Wt); line(a, c + o, e, c + o, 0.12, Wt); }
        // stop lines at both ends of each segment (only the inbound half)
        line(c, a + 1.9, c + R / 2 * K - 0.3, a + 1.9, 0.45, Wt); line(c - R / 2 * K + 0.3, e - 1.9, c, e - 1.9, 0.45, Wt);
        line(a + 1.9, c - R / 2 * K + 0.3, a + 1.9, c, 0.45, Wt); line(e - 1.9, c, e - 1.9, c + R / 2 * K - 0.3, 0.45, Wt);
      }
    }
    for (let a = 0; a <= N; a++) for (let b = 0; b <= N; b++) {      // zebra crossings
      const x = a * P * K, z = b * P * K, r = R * K;
      for (let t = 0.7; t < r - 0.5; t += 0.9) {
        if (b > 0) line(x + t, z - 1.6, x + t, z - 0.1, 0.45, Wt); if (b < N) line(x + t, z + r + 0.1, x + t, z + r + 1.6, 0.45, Wt);
        if (a > 0) line(x - 1.6, z + t, x - 0.1, z + t, 0.45, Wt); if (a < N) line(x + r + 0.1, z + t, x + r + 1.6, z + t, 0.45, Wt);
      }
    }
    const paint = new THREE.Mesh(pb.geometry(), M.paint); paint.receiveShadow = true; root.add(paint);
  }
  function buildBlockGround(bl, ch) {
    const x0 = bl.x * K, z0 = bl.y * K, s = B * K, sw = SW * K;
    const sb = bk(ch, 'sidewalk'), cb = bk(ch, 'curb');
    sb.face([x0 + s / 2, H0, z0 + sw / 2], UP, [0, 0, -1], s / 2, sw / 2, 2.2); sb.face([x0 + s / 2, H0, z0 + s - sw / 2], UP, [0, 0, -1], s / 2, sw / 2, 2.2);
    sb.face([x0 + sw / 2, H0, z0 + s / 2], UP, [0, 0, -1], sw / 2, s / 2 - sw, 2.2); sb.face([x0 + s - sw / 2, H0, z0 + s / 2], UP, [0, 0, -1], sw / 2, s / 2 - sw, 2.2);
    const inner = bl.type === 'park' ? 'grass' : bl.type === 'plaza' ? 'pavers' : 'pavers';
    bk(ch, inner).face([x0 + s / 2, H0 + 0.002, z0 + s / 2], UP, [0, 0, -1], s / 2 - sw, s / 2 - sw, inner === 'grass' ? 4 : 2.5);
    cb.box(x0 + s / 2, H0 / 2, z0 + s / 2, s, H0, s, null, 1.2, 0b110011);
    for (const [cx, cz, w, d] of [[x0 + s / 2, z0 + 0.14, s, 0.28], [x0 + s / 2, z0 + s - 0.14, s, 0.28], [x0 + 0.14, z0 + s / 2, 0.28, s], [x0 + s - 0.14, z0 + s / 2, 0.28, s]]) cb.face([cx, H0 + 0.004, cz], UP, [0, 0, -1], w / 2, d / 2, 1.2);
    if (bl.type === 'plaza') { const pb = bk(ch, 'concrete'); pb.cyl(x0 + s / 2, H0, z0 + s / 2, 3.2, 0.7, 24, [0.85, 0.85, 0.85]); bk(ch, 'water').cyl(x0 + s / 2, H0 + 0.71, z0 + s / 2, 2.9, 0.01, 24, null); }
  }

  // ---------------------------------------------------------------- buildings
  const FLOOR = 3.3, GH = 4.4;
  const PASTEL = ['#f4b6c2', '#a8e6cf', '#ffd3a5', '#b5c7ff', '#fdfd96', '#e0bbff', '#9ee7f0', '#ffffff', '#f7cac9', '#d4f0c0'];
  const signs = [];
  function frontFace(b, f) {
    const x0 = b.x * K, z0 = b.y * K, w = b.w * K, d = b.h * K;
    if (f === 'S') return { s: [x0, 0, z0 + d], T: [1, 0, 0], N: [0, 0, 1], len: w };
    if (f === 'N') return { s: [x0 + w, 0, z0], T: [-1, 0, 0], N: [0, 0, -1], len: w };
    if (f === 'E') return { s: [x0 + w, 0, z0 + d], T: [0, 0, -1], N: [1, 0, 0], len: d };
    return { s: [x0, 0, z0], T: [0, 0, 1], N: [-1, 0, 0], len: d };
  }
  const at = (F, u, v, o) => [F.s[0] + F.T[0] * u + F.N[0] * o, H0 + v, F.s[2] + F.T[2] * u + F.N[2] * o];
  function neighbourGap(b, bl, f) {
    for (const o of bl.bs) { if (o === b) continue;
      if (f === 'E' && Math.abs(o.x - (b.x + b.w)) < 20 && o.y < b.y + b.h && o.y + o.h > b.y) return true;
      if (f === 'W' && Math.abs(o.x + o.w - b.x) < 20 && o.y < b.y + b.h && o.y + o.h > b.y) return true;
      if (f === 'S' && Math.abs(o.y - (b.y + b.h)) < 20 && o.x < b.x + b.w && o.x + o.w > b.x) return true;
      if (f === 'N' && Math.abs(o.y + o.h - b.y) < 20 && o.x < b.x + b.w && o.x + o.w > b.x) return true; }
    return false;
  }
  function building(b, bl, ch) {
    const r = mulberry(Math.floor(b.seed * 1e9));
    const ci = bl.i, cj = bl.j, central = ci >= 2 && ci <= 5 && cj >= 2 && cj <= 5;
    let floors = b.floors + (central && r() < 0.55 ? Math.floor(4 + r() * 12) : 0);
    if (b.poi) floors = Math.min(floors, 5);
    const tower = floors >= 11 && !b.poi;
    const style = tower ? 'tower' : r() < 0.32 ? 'brick' : r() < 0.22 ? 'concrete' : 'plaster';
    const tint = style === 'plaster' ? hexRGB(PASTEL[Math.floor(r() * PASTEL.length)]) : style === 'brick' ? mix([1, 1, 1], hexRGB('#d9b8a0'), r() * 0.5) : mix([0.92, 0.9, 0.86], [0.75, 0.75, 0.78], r());
    const trimC = style === 'plaster' ? mix(tint, [1, 1, 1], 0.55) : [0.88, 0.86, 0.82];
    const x0 = b.x * K, z0 = b.y * K, w = b.w * K, d = b.h * K, Ht = GH + (floors - 1) * FLOOR + 0.4, cx = x0 + w / 2, cz = z0 + d / 2;
    const wallB = bk(ch, style === 'tower' ? 'tower' : style), tile = style === 'brick' ? 2.2 : style === 'concrete' ? FLOOR : 3;
    const faces = ['S', 'N', 'E', 'W'];
    // body
    if (tower) {
      bk(ch, 'concrete').box(cx, H0 + GH / 2, cz, w, GH, d, [0.8, 0.8, 0.82], FLOOR, 0b110011);
      for (const f of faces) { const F = frontFace(b, f), c = at(F, F.len / 2, GH + (Ht - GH) / 2, 0); wallB.face(c, F.N, UP, F.len / 2, (Ht - GH) / 2, [(dot(c, cross(UP, F.N)) - F.len / 2) / 25.6, (GH) / 27.2, (dot(c, cross(UP, F.N)) + F.len / 2) / 25.6, Ht / 27.2]); }
      bk(ch, 'roof').face([cx, H0 + Ht, cz], UP, [0, 0, -1], w / 2, d / 2, 4);
      bk(ch, 'concrete').box(cx, H0 + Ht + 1.6, cz, w * 0.55, 3.2, d * 0.55, [0.75, 0.75, 0.78], 3);
      bk(ch, 'metal').box(cx + w * 0.1, H0 + Ht + 6, cz, 0.25, 6, 0.25, [0.6, 0.6, 0.6]);
      bk(ch, 'trim').box(cx, H0 + GH + 0.2, cz, w + 0.3, 0.4, d + 0.3, [0.9, 0.9, 0.9], 3, 0b110111);
    } else {
      wallB.box(cx, H0 + Ht / 2, cz, w, Ht, d, tint, tile, 0b110011);
      bk(ch, 'roof').face([cx, H0 + Ht, cz], UP, [0, 0, -1], w / 2 - 0.3, d / 2 - 0.3, 4);
      // parapet + coping
      const tb = bk(ch, 'trim'), pc = trimC;
      for (const [px, pz, sx, sz] of [[cx, z0 + 0.15, w, 0.3], [cx, z0 + d - 0.15, w, 0.3], [x0 + 0.15, cz, 0.3, d], [x0 + w - 0.15, cz, 0.3, d]]) wallB.box(px, H0 + Ht + 0.45, pz, sx, 0.9, sz, tint, tile, 0b111111);
      tb.box(cx, H0 + Ht + 0.95, cz, w + 0.25, 0.14, d + 0.25, pc, 2, 0b111111);
      tb.box(cx, H0 + GH, cz, w + 0.24, 0.35, d + 0.24, pc, 2, 0b110111);                               // string course over the shops
      if (style === 'plaster') for (let f = 2; f < floors; f++) tb.box(cx, H0 + GH + (f - 1) * FLOOR, cz, w + 0.1, 0.12, d + 0.1, pc, 2, 0b110011);
    }
    // windows on every exposed face
    const frameB = bk(ch, 'frame'), glassB = bk(ch, 'glass'), litB = bk(ch, 'glassLit'), metalB = bk(ch, 'metal');
    const fcol = style === 'brick' ? [0.95, 0.95, 0.92] : style === 'concrete' ? [0.22, 0.23, 0.25] : [1, 1, 1];
    let escapeDone = false;
    if (!tower) for (const f of faces) {
      if (neighbourGap(b, bl, f)) continue;
      const F = frontFace(b, f), bays = Math.max(1, Math.floor((F.len - 1.2) / 3.2)), step = (F.len - 1.2) / bays;
      const escape = style === 'brick' && !escapeDone && f !== b.front && floors >= 3 && r() < 0.75 && bays >= 2; if (escape) escapeDone = true;
      for (let fl = 1; fl < floors; fl++) for (let k = 0; k < bays; k++) {
        const u = 0.6 + step * (k + 0.5), v = GH + (fl - 1) * FLOOR + 0.95, ww = Math.min(1.5, step * 0.55), wh = 1.75;
        const c = at(F, u, v + wh / 2, 0.02), lit = r() < 0.38;
        if (lit) { const cell = Math.floor(r() * 16), cu = (cell % 4) / 4, cv = Math.floor(cell / 4) / 4; litB.face(c, F.N, UP, ww / 2, wh / 2, [cu, cv, cu + 0.25, cv + 0.25]); }
        else glassB.face(c, F.N, UP, ww / 2, wh / 2, [0, 0, 1, 1]);
        const T = F.T;
        frameB.obox(at(F, u, v + wh + 0.05, 0.08), T, UP, F.N, ww / 2 + 0.12, 0.07, 0.08, fcol, null, 31);
        frameB.obox(at(F, u, v - 0.05, 0.12), T, UP, F.N, ww / 2 + 0.18, 0.06, 0.12, fcol, null, 31);
        frameB.obox(at(F, u - ww / 2 - 0.05, v + wh / 2, 0.08), T, UP, F.N, 0.06, wh / 2, 0.08, fcol, null, 31);
        frameB.obox(at(F, u + ww / 2 + 0.05, v + wh / 2, 0.08), T, UP, F.N, 0.06, wh / 2, 0.08, fcol, null, 31);
        frameB.obox(at(F, u, v + wh / 2, 0.05), T, UP, F.N, 0.025, wh / 2, 0.04, fcol, null, 31);
        if (r() < 0.07 && !escape) metalB.obox(at(F, u, v - 0.4, 0.3), T, UP, F.N, 0.38, 0.27, 0.3, [0.75, 0.76, 0.78]);
        if (style === 'plaster' && r() < 0.06 && !escape) { bk(ch, 'concrete').obox(at(F, u, v - 0.1, 0.55), T, UP, F.N, ww / 2 + 0.6, 0.08, 0.55, [0.9, 0.9, 0.9]); metalB.obox(at(F, u, v + 0.45, 1.08), T, UP, F.N, ww / 2 + 0.6, 0.03, 0.03, [0.85, 0.85, 0.85]); for (let q = -2; q <= 2; q++) metalB.obox(at(F, u + q * (ww / 2 + 0.6) / 2, v + 0.22, 1.08), T, UP, F.N, 0.015, 0.25, 0.015, [0.85, 0.85, 0.85]); }
      }
      if (escape) {           // fire escape: landings, railings and stairs on one side
        const u0 = 0.6 + step * 0.5 - 0.9, u1 = 0.6 + step * 1.5 + 0.9, um = (u0 + u1) / 2, half = (u1 - u0) / 2, gc = [0.18, 0.18, 0.2];
        for (let fl = 1; fl < floors; fl++) {
          const v = GH + (fl - 1) * FLOOR + 0.85;
          metalB.obox(at(F, um, v, 0.65), F.T, UP, F.N, half, 0.04, 0.6, gc);
          metalB.obox(at(F, um, v + 0.95, 1.22), F.T, UP, F.N, half, 0.03, 0.03, gc);
          for (let q = 0; q <= 8; q++) metalB.obox(at(F, u0 + q * (half * 2 / 8), v + 0.48, 1.22), F.T, UP, F.N, 0.015, 0.48, 0.015, gc);
          if (fl > 1) { const a = Math.atan2(FLOOR, half * 1.6), dir = [F.T[0] * Math.cos(a), Math.sin(a), F.T[2] * Math.cos(a)], upv = cross(F.N, dir).map(x => -x);
            metalB.obox(at(F, um, v - FLOOR / 2, 0.9), dir, upv, F.N, Math.hypot(FLOOR, half * 1.6) / 2, 0.03, 0.28, gc); }
        }
      }
    }
    // storefront on the street face
    if (!tower || true) storefront(b, bl, ch, r, style, tint, tower);
    // roof clutter
    const rb = bk(ch, 'metal');
    const nAc = 1 + Math.floor(r() * 3);
    for (let a = 0; a < nAc; a++) { const ax = x0 + 1.5 + r() * Math.max(0.5, w - 3), az = z0 + 1.5 + r() * Math.max(0.5, d - 3); rb.box(ax, H0 + Ht + 0.55, az, 1.6, 1.1, 1.2, [0.72, 0.73, 0.75], 1); rb.cyl(ax, H0 + Ht + 1.1, az, 0.42, 0.06, 12, [0.3, 0.3, 0.32]); }
    if (!tower && r() < 0.35 && w > 6 && d > 6) { const tx = x0 + w * (0.25 + r() * 0.5), tz = z0 + d * (0.25 + r() * 0.5); for (const [lx, lz] of [[-0.9, -0.9], [0.9, -0.9], [-0.9, 0.9], [0.9, 0.9]]) rb.box(tx + lx, H0 + Ht + 1.2, tz + lz, 0.12, 2.4, 0.12, [0.35, 0.3, 0.25]); bk(ch, 'brick').cyl(tx, H0 + Ht + 2.4, tz, 1.4, 2.6, 16, [0.62, 0.45, 0.32]); rb.cyl(tx, H0 + Ht + 5, tz, 1.5, 0.35, 16, [0.3, 0.26, 0.22]); }
    if (!tower && r() < 0.14 && w > 8) {        // rooftop billboard facing the front street
      const F = frontFace(b, b.front), cell = Math.floor(r() * 4), cu = (cell % 2) / 2, cv = 1 - (Math.floor(cell / 2) + 1) / 2, bw = Math.min(9, F.len * 0.8), bh = bw / 2;
      const c = at(F, F.len / 2, Ht + 1.4 + bh / 2, -1.2);
      bk(ch, 'billboard').face(c, F.N, UP, bw / 2, bh / 2, [cu, cv, cu + 0.5, cv + 0.5]);
      rb.obox(at(F, F.len / 2, Ht + 1.4 + bh / 2, -1.32), F.T, UP, F.N, bw / 2 + 0.15, bh / 2 + 0.15, 0.1, [0.25, 0.25, 0.27]);
      for (const q of [-0.3, 0.3]) rb.obox(at(F, F.len / 2 + q * bw, Ht + 0.7, -1.5), F.T, UP, F.N, 0.1, 0.7, 0.1, [0.25, 0.25, 0.27]);
    }
    b._h = Ht;
  }
  function storefront(b, bl, ch, r, style, tint, tower) {
    const F = frontFace(b, b.front), L = F.len, sb = bk(ch, 'store'), fb = bk(ch, 'frame'), dark = [0.12, 0.12, 0.13];
    const g0 = 0.45, g1 = 3.1, du = Math.max(1.4, Math.min(L - 1.4, b.doorU * L));
    // display glass with a shop interior behind it, split around the door
    const cell = Math.floor(r() * 8), cu = (cell % 4) / 4, cv = 1 - (Math.floor(cell / 4) + 1) / 2;
    const segs = [[0.5, du - 0.75], [du + 0.75, L - 0.5]];
    for (const [a, e] of segs) { if (e - a < 0.5) continue; const c = at(F, (a + e) / 2, (g0 + g1) / 2, 0.03); sb.face(c, F.N, UP, (e - a) / 2, (g1 - g0) / 2, [cu, cv, cu + 0.25 * Math.min(1, (e - a) / 6), cv + 0.5]);
      for (let m = a; m <= e + 0.01; m += Math.max(1.2, (e - a) / Math.max(1, Math.round((e - a) / 2)))) fb.obox(at(F, Math.min(m, e), (g0 + g1) / 2, 0.07), F.T, UP, F.N, 0.05, (g1 - g0) / 2, 0.06, dark); }
    fb.obox(at(F, L / 2, g0 / 2, 0.06), F.T, UP, F.N, L / 2 - 0.4, g0 / 2, 0.06, dark);
    fb.obox(at(F, L / 2, g1 + 0.05, 0.07), F.T, UP, F.N, L / 2 - 0.4, 0.06, 0.07, dark);
    // door
    bk(ch, 'glass').face(at(F, du, 1.2, 0.04), F.N, UP, 0.55, 1.2, null);
    fb.obox(at(F, du, 2.45, 0.08), F.T, UP, F.N, 0.7, 0.06, 0.08, dark); fb.obox(at(F, du - 0.62, 1.2, 0.08), F.T, UP, F.N, 0.06, 1.2, 0.08, dark); fb.obox(at(F, du + 0.62, 1.2, 0.08), F.T, UP, F.N, 0.06, 1.2, 0.08, dark);
    fb.obox(at(F, du + 0.4, 1.1, 0.12), F.T, UP, F.N, 0.02, 0.25, 0.02, [0.85, 0.85, 0.85]);
    // awning
    const awn = hexRGB(b.awn || '#e11d48'), aw = Math.min(L - 1, Math.max(3, L * (0.55 + r() * 0.4))), au = Math.max(aw / 2 + 0.5, Math.min(L - aw / 2 - 0.5, du));
    const depth = 1.4, drop = 0.55, len = Math.hypot(depth, drop), dir = [F.N[0] * depth / len, -drop / len, F.N[2] * depth / len], up2 = cross(dir, F.T).map(v => -v);
    bk(ch, 'fabric').obox(at(F, au, g1 + 0.75 - drop / 2, depth / 2), F.T, up2, dir.map((v, k) => v), aw / 2, 0.03, len / 2, awn, 1);
    bk(ch, 'fabric').obox(at(F, au, g1 + 0.75 - drop - 0.15, depth), F.T, UP, F.N, aw / 2, 0.15, 0.02, awn, 1);
    // neon sign above the awning
    const text = b.sign, col = b.signCol; signs.push({ text, col });
    const sw = Math.min(L * 0.8, 5.5), sh = sw / 4;
    b._sign = { F, u: L / 2, v: g1 + 1.0 + sh / 2, sw, sh, key: text + '|' + col };
    bk(ch, 'metal').obox(at(F, L / 2, g1 + 1.0 + sh / 2, 0.08), F.T, UP, F.N, sw / 2 + 0.1, sh / 2 + 0.08, 0.08, [0.1, 0.1, 0.12]);
    if (r() < 0.25 && !b.poi) { const pu = segs[1][0] + 1.2; if (pu < L - 1.5) b._shutter = { F, u: pu + 1.3 }; }
  }
  function placeSigns() { for (const bl of World.blocks) for (const b of bl.bs) { const s = b._sign; if (!s) continue; const ch = chunkFor(bl.i, bl.j), uv = signCells[s.key]; bk(ch, 'signs').face(at(s.F, s.u, s.v, 0.17), s.F.N, UP, s.sw / 2, s.sh / 2, uv); } }

  // ---------------------------------------------------------------- vegetation
  function buildPalms(root) {
    const palms = [], trees = []; for (const bl of World.blocks) for (const t of bl.trees) (t.palm ? palms : trees).push(t);
    // trunk: curved tapering tube; crown: 11 drooping fronds
    const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.25, 3, 0), new THREE.Vector3(0.7, 6, 0), new THREE.Vector3(1.0, 8.6, 0)]);
    const trunkG = new THREE.TubeGeometry(curve, 14, 0.13, 8, false); const tp = trunkG.attributes.position;
    for (let i = 0; i < tp.count; i++) { const y = tp.getY(i), k = 1.35 - y / 8.6 * 0.55; const c = curve.getPoint(Math.max(0, Math.min(1, y / 8.6))); tp.setX(i, c.x + (tp.getX(i) - c.x) * k); tp.setZ(i, c.z + (tp.getZ(i) - c.z) * k); }
    trunkG.computeVertexNormals(); const uvs = trunkG.attributes.uv; for (let i = 0; i < uvs.count; i++) uvs.setXY(i, uvs.getY(i) * 2, uvs.getX(i) * 6);
    const fronds = [];
    for (let i = 0; i < 11; i++) {
      const g = new THREE.PlaneGeometry(4.6, 1.3, 10, 1).rotateX(-Math.PI / 2); const p = g.attributes.position;
      for (let k = 0; k < p.count; k++) { const x = p.getX(k) + 2.3, z = p.getZ(k); p.setX(k, x); p.setY(k, -0.12 * x * x + 0.38 * x - Math.abs(z) * 0.25); }
      g.computeVertexNormals(); g.rotateX(-0.25 + (i % 2) * 0.2); g.rotateY(i * (Math.PI * 2 / 11) + (i % 3) * 0.1); g.translate(1.0, 8.55, 0); fronds.push(g);
    }
    const crownG = THREE.BufferGeometryUtils.mergeGeometries(fronds);
    const d = new THREE.Object3D();
    for (const [ch, sub] of byChunk(palms, t => [t.x * K, t.y * K])) {
      const tI = new THREE.InstancedMesh(trunkG, M.bark, sub.length), fI = new THREE.InstancedMesh(crownG, M.frond, sub.length);
      sub.forEach((t, i) => { d.position.set(t.x * K, H0, t.y * K); d.rotation.set(0, t.k * 6.28, 0); d.scale.setScalar(0.8 + t.k * 0.45); d.updateMatrix(); tI.setMatrixAt(i, d.matrix); fI.setMatrixAt(i, d.matrix); });
      tI.computeBoundingSphere(); fI.computeBoundingSphere(); tI.castShadow = fI.castShadow = true; tI.receiveShadow = true; ch.group.add(tI, fI);
    }
    if (trees.length) {
      // canopy = a dense shell of alpha-tested leaf cards around a dark core, like real-time foliage
      const R3 = mulberry(11), cards = [new THREE.IcosahedronGeometry(1.7, 1).translate(0, 4.7, 0)];
      for (let k = 0; k < 46; k++) { const u = R3() * 2 - 1, th = R3() * 6.283, rr = 2.0 + R3() * 0.6, x = Math.sqrt(1 - u * u) * Math.cos(th) * rr, z = Math.sqrt(1 - u * u) * Math.sin(th) * rr, y = 4.7 + u * rr * 0.75;
        const q = new THREE.PlaneGeometry(1.9, 1.9); q.lookAt(new THREE.Vector3(x, y - 4.7, z)); q.rotateZ(R3() * 3); q.translate(x, y, z); cards.push(q); }
      const cg = THREE.BufferGeometryUtils.mergeGeometries(cards.map(g => g.index ? g.toNonIndexed() : g));
      const nrm = cg.attributes.normal; for (let i = 0; i < nrm.count; i++) { const v = new THREE.Vector3(cg.attributes.position.getX(i), cg.attributes.position.getY(i) - 4.7, cg.attributes.position.getZ(i)).normalize(); nrm.setXYZ(i, v.x, v.y, v.z); }
      const tg = new THREE.CylinderGeometry(0.18, 0.3, 3.6, 8).translate(0, 1.8, 0);
      for (const [ch, sub] of byChunk(trees, t => [t.x * K, t.y * K])) {
        const tr = new THREE.InstancedMesh(tg, M.bark, sub.length), cr = new THREE.InstancedMesh(cg, M.leaf, sub.length);
        sub.forEach((t, i) => { d.position.set(t.x * K, H0, t.y * K); d.rotation.set(0, t.k * 6.28, 0); d.scale.setScalar(0.75 + t.k * 0.5); d.updateMatrix(); tr.setMatrixAt(i, d.matrix); cr.setMatrixAt(i, d.matrix); });
        tr.computeBoundingSphere(); cr.computeBoundingSphere(); tr.castShadow = cr.castShadow = true; ch.group.add(tr, cr);
      }
    }
  }

  // ---------------------------------------------------------------- streetlights + traffic signals
  let lensI = null, signals = [], lampHeads = null, pools = null;
  function buildLights(root) {
    const lamps = [];
    for (const bl of World.blocks) {
      const x0 = bl.x * K, z0 = bl.y * K, s = B * K;
      for (const [px, pz, nx, nz] of [[x0 + s / 2, z0 + 0.5, 0, -1], [x0 + s / 2, z0 + s - 0.5, 0, 1], [x0 + 0.5, z0 + s / 2, -1, 0], [x0 + s - 0.5, z0 + s / 2, 1, 0]]) lamps.push([px, pz, nx, nz]);
    }
    const n = lamps.length, d = new THREE.Object3D();
    const pole = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.08, 0.13, 8, 10).translate(0, 4, 0), M.metal, n);
    const arm = new THREE.InstancedMesh(new THREE.BoxGeometry(2.6, 0.1, 0.1).translate(1.3, 7.9, 0), M.metal, n);
    const head = new THREE.InstancedMesh(new THREE.BoxGeometry(0.75, 0.16, 0.34).translate(2.6, 7.85, 0), M.metal, n);
    lampHeads = new THREE.InstancedMesh(new THREE.BoxGeometry(0.6, 0.04, 0.26).translate(2.6, 7.76, 0), M.lens, n);
    pools = new THREE.InstancedMesh(new THREE.PlaneGeometry(8, 8).rotateX(-Math.PI / 2).translate(3.2, 0.03, 0), M.pool, n);
    lamps.forEach(([x, z, nx, nz], i) => { d.position.set(x, H0, z); d.rotation.set(0, Math.atan2(-nz, nx), 0); d.updateMatrix(); for (const m of [pole, arm, head, lampHeads]) m.setMatrixAt(i, d.matrix); d.position.y = 0; d.updateMatrix(); pools.setMatrixAt(i, d.matrix); });
    pole.castShadow = arm.castShadow = true; root.add(pole, arm, head, lampHeads, pools);
    // traffic signals
    const heads = [];
    for (let i = 0; i <= N; i++) for (let j = 0; j <= N; j++) for (let dd = 0; dd < 4; dd++) {
      const pi = i - DX[dd], pj = j - DY[dd]; if (pi < 0 || pj < 0 || pi > N || pj > N) continue;   // nobody approaches from outside the map
      const cx = World.center(i), cy = World.center(j), rx = -DY[dd], ry = DX[dd], off = R / 2 + 14;
      const px = cx - DX[dd] * off + rx * off, py = cy - DY[dd] * off + ry * off, armLen = (off - World.LO) * K;
      heads.push({ i, j, axis: dd % 2, x: px * K, z: py * K, ang: Math.atan2(-ry, rx), face: Math.atan2(DY[dd], -DX[dd]), armLen });
    }
    const hn = heads.length;
    const sp = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.1, 0.12, 6.2, 8).translate(0, 3.1, 0), M.metal, hn);
    const sa = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.12, 0.12).translate(0.5, 6, 0), M.metal, hn);
    const housing = new THREE.InstancedMesh(new THREE.BoxGeometry(0.36, 1.05, 0.36), new THREE.MeshStandardMaterial({ color: 0x1b1d12, roughness: 0.6 }), hn);
    lensI = new THREE.InstancedMesh(new THREE.CircleGeometry(0.12, 14), new THREE.MeshBasicMaterial({ color: 0xffffff }), hn * 3);
    let li = 0;
    heads.forEach((h, k) => {
      d.position.set(h.x, H0, h.z); d.rotation.set(0, h.ang, 0); d.scale.set(1, 1, 1); d.updateMatrix(); sp.setMatrixAt(k, d.matrix); d.scale.set(h.armLen, 1, 1); d.updateMatrix(); sa.setMatrixAt(k, d.matrix);
      const hx = h.x + Math.cos(h.ang) * h.armLen, hz = h.z - Math.sin(h.ang) * h.armLen; d.scale.set(1, 1, 1); d.position.set(hx, H0 + 5.35, hz); d.rotation.set(0, h.face, 0); d.updateMatrix(); housing.setMatrixAt(k, d.matrix);
      h.lens = li;
      for (let q = 0; q < 3; q++) { const o = new THREE.Object3D(); o.position.set(hx, H0 + 5.68 - q * 0.33, hz); o.rotation.set(0, h.face - Math.PI / 2, 0); o.translateZ(0.19); o.updateMatrix(); lensI.setMatrixAt(li++, o.matrix); }
    });
    lensI.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(hn * 9), 3);
    sp.castShadow = true; root.add(sp, sa, housing, lensI); signals = heads;
  }
  const C_ON = [[12, 0.4, 0.25], [12, 7, 0.5], [0.5, 11, 3.2]], C_OFF = [[0.18, 0.03, 0.03], [0.18, 0.13, 0.02], [0.02, 0.14, 0.06]];
  function updateLights(t, dark) {
    if (lensI) {
      const a = lensI.instanceColor.array;
      const f = 0.3 + 0.7 * Math.max(0, Math.min(1, (dark - 0.18) * 2.5)); for (const h of signals) { const s = World.signal(h.i, h.j, h.axis, t), on = s === 'R' ? 0 : s === 'Y' ? 1 : 2; for (let q = 0; q < 3; q++) { const c = q === on ? C_ON[q] : C_OFF[q]; a[(h.lens + q) * 3] = c[0] * (q === on ? f : 1); a[(h.lens + q) * 3 + 1] = c[1] * (q === on ? f : 1); a[(h.lens + q) * 3 + 2] = c[2] * (q === on ? f : 1); } }
      lensI.instanceColor.needsUpdate = true;
    }
    const k = Math.max(0, Math.min(1, (dark - 0.18) * 2.5));
    M.lens.color.setRGB(0.5 + k * 9, 0.45 + k * 7.5, 0.35 + k * 5); M.pool.opacity = k * 0.38;
    for (const m of nightMats) { const n = m.userData.night; m.emissiveIntensity = n.base + (n.night - n.base) * k; }
  }

  // ---------------------------------------------------------------- props from scanned models
  function instanceModel(root, name, list, opts) {
    if (!list.length) return; opts = opts || {};
    const parts = Assets.parts(name, opts.filter), d = new THREE.Object3D();
    for (const [ch, sub] of byChunk(list, q => [q[0], q[2]])) for (const p of parts) {
      const im = new THREE.InstancedMesh(p.geo, p.mat, sub.length);
      sub.forEach((q, i) => { d.position.set(q[0], q[1], q[2]); d.rotation.set(0, q[3] || 0, 0); d.scale.setScalar(q[4] || opts.scale || 1); d.updateMatrix(); im.setMatrixAt(i, d.matrix); });
      im.computeBoundingSphere(); im.castShadow = !!opts.shadow; im.receiveShadow = true; ch.group.add(im);
    }
  }
  function buildProps(root) {
    const R2 = mulberry(4242), L = {};
    const add = (n, q) => (L[n] || (L[n] = [])).push(q);
    for (const bl of World.blocks) {
      const x0 = bl.x * K, z0 = bl.y * K, s = B * K, curb = 0.75;
      const sides = [[x0, z0 + curb, 1, 0, 0], [x0, z0 + s - curb, 1, 0, Math.PI], [x0 + curb, z0, 0, 1, -Math.PI / 2], [x0 + s - curb, z0, 0, 1, Math.PI / 2]];
      const pick = () => sides[Math.floor(R2() * 4)], along = (sd, t) => [sd[0] + sd[2] * s * t, H0, sd[1] + sd[3] * s * t];
      { const sd = pick(), p = along(sd, 0.2 + R2() * 0.6); add('fire_hydrant', [p[0], p[1], p[2], sd[4] + R2(), 1]); }
      for (let k = 0; k < 2; k++) { const sd = pick(), p = along(sd, k ? 0.12 : 0.86); add('metal_trash_can', [p[0], p[1], p[2], R2() * 6, 0.9]); }
      if (R2() < 0.5) { const sd = pick(), p = along(sd, 0.3 + R2() * 0.4); add('utility_box_01', [p[0], p[1], p[2], sd[4], 1]); }
      if (R2() < 0.35) { const sd = pick(), p = along(sd, 0.4 + R2() * 0.2); add('korean_public_payphone_01', [p[0], p[1], p[2], sd[4] + Math.PI, 2.2]); }
      if (bl.type === 'bld' && R2() < 0.55) { const sd = pick(), p = along(sd, 0.55 + R2() * 0.3), o = [sd[3], -sd[2]]; for (let k = 0; k < 2 + Math.floor(R2() * 3); k++) add('trashbag', [p[0] + o[0] * (1.4 + R2() * 0.4) + R2() * 0.8, H0, p[2] + o[1] * (1.4 + R2() * 0.4) + R2() * 0.8, R2() * 6, 0.9 + R2() * 0.4]); if (R2() < 0.6) add('cardboard_box_01', [p[0] + o[0] * 1.6 + 0.9, H0, p[2] + o[1] * 1.6, R2() * 6, 1.4]); }
      if (bl.type === 'bld' && R2() < 0.3) { const sd = pick(), p = along(sd, 0.1 + R2() * 0.8), o = [sd[3], -sd[2]]; add(R2() < 0.5 ? 'Barrel_01' : 'wooden_crate_02', [p[0] + o[0] * 1.5, H0, p[2] + o[1] * 1.5, R2() * 6, 1]); }
      if (bl.type !== 'bld') for (let k = 0; k < 4; k++) { const sd = sides[k], p = along(sd, 0.5), o = [sd[3], -sd[2]]; add('street_lamp_01', [p[0] + o[0] * 3.5, H0, p[2] + o[1] * 3.5, 0, 1.1]); }
      if (bl.type === 'bld') for (const b of bl.bs) if (R2() < 0.3 && b._sign) { const F = b._sign.F; add('potted_plant_02', [F.s[0] + F.T[0] * 0.6 + F.N[0] * 0.5, H0, F.s[2] + F.T[2] * 0.6 + F.N[2] * 0.5, R2() * 6, 1.3]); }
    }
    // manholes on the roads
    for (let k = 0; k <= N; k++) for (let s = 0; s < N; s++) { const c = (k * P + R / 2) * K, m = ((s + 0.5) * P + R / 2) * K; add('water_manhole_cover', [c + (R2() < 0.5 ? -2.3 : 2.3), 0.005, m + (R2() - 0.5) * 8, R2() * 6, 1]); add('water_manhole_cover', [m + (R2() - 0.5) * 8, 0.005, c + (R2() < 0.5 ? -2.3 : 2.3), R2() * 6, 1]); }
    instanceModel(root, 'fire_hydrant', L.fire_hydrant || [], { filter: n => !n.includes('aged'), shadow: true });
    instanceModel(root, 'metal_trash_can', L.metal_trash_can || [], { filter: n => !n.includes('rust') });
    for (const n of ['utility_box_01', 'korean_public_payphone_01', 'trashbag', 'cardboard_box_01', 'Barrel_01', 'wooden_crate_02', 'street_lamp_01', 'potted_plant_02']) instanceModel(root, n, L[n] || [], { shadow: n === 'street_lamp_01' || n === 'utility_box_01' });
    instanceModel(root, 'water_manhole_cover', L.water_manhole_cover || [], { shadow: false });
    // roll-up shutters on some closed shops
    const sh = []; for (const bl of World.blocks) for (const b of bl.bs) if (b._shutter) { const F = b._shutter.F, u = b._shutter.u; sh.push([F.s[0] + F.T[0] * u + F.N[0] * 0.12, H0, F.s[2] + F.T[2] * u + F.N[2] * 0.12, Math.atan2(F.N[0], F.N[2]), 1]); }
    instanceModel(root, 'rollershutter_door', sh, { filter: n => n.includes('graffiti') });
  }

  // ---------------------------------------------------------------- build all
  function build(root, k) {
    K = k; makeMaterials();
    for (let i = 0; i < NC * NC; i++) { const ch = newChunk(i); chunks.push(ch); root.add(ch.group); }
    buildGround(root);
    for (const bl of World.blocks) { const ch = chunkFor(bl.i, bl.j); buildBlockGround(bl, ch); for (const b of bl.bs) building(b, bl, ch); }
    M.signs = std({ map: signAtlas(signs), emissive: 0xffffff, roughness: 0.4 }, { base: 2.5, night: 7 }); M.signs.emissiveMap = M.signs.map;
    placeSigns();
    M.water.color.set(0x0d4f6a);
    for (const ch of chunks) for (const name in ch.b) {
      const g = ch.b[name].geometry(); if (!g) continue;
      const mesh = new THREE.Mesh(g, M[name]); mesh.castShadow = !['paint', 'sidewalk', 'grass', 'pavers', 'store', 'glassLit', 'glass', 'signs', 'water', 'frame', 'curb', 'fabric'].includes(name); mesh.receiveShadow = true; ch.group.add(mesh);
    }
    buildPalms(root); buildLights(root); buildProps(root);
    return { update: updateLights, cull, materials: M };
  }
  return { build, H0, nightMats, get K() { return K; } };
})();
