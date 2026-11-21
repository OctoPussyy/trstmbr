// The city: an 8x8 grid of blocks separated by roads. Everything is generated from a seed, no map files.
// Road k occupies [k*P, k*P+R] on both axes; block (i,j) occupies [i*P+R, i*P+R+B]. Sidewalk = outer SW px of a block.
const World = (() => {
  const N = 8, R = 190, B = 450, P = B + R, SW = 46, FH = 44, LO = 34;
  const SIZE = N * P + R;
  const DX = [1, 0, -1, 0], DY = [0, 1, 0, -1];            // dir index: 0 east, 1 south, 2 west, 3 north

  function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  const rand = mulberry(90210);
  const pick = a => a[Math.floor(rand() * a.length)];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  function shade(hex, f) {
    const n = parseInt(hex.slice(1), 16);
    const r = clamp(((n >> 16) & 255) * f, 0, 255) | 0, g = clamp(((n >> 8) & 255) * f, 0, 255) | 0, b = clamp((n & 255) * f, 0, 255) | 0;
    return `rgb(${r},${g},${b})`;
  }

  const WALLS = ['#b5523b', '#d9b382', '#7fc4a8', '#e59bb5', '#5aa7b5', '#9b7bc9', '#e0c15a', '#c98a6b', '#8fb0d6', '#d8d2c4'];
  const SIGNS = [['LIQUOR', '#ff3860'], ['PAWN', '#ffd23f'], ['TACOS', '#3ef2a0'], ['RECORDS', '#ff4fd8'], ['BARBER', '#3ec8ff'], ['WINGS', '#ff9a3c'],
    ['NAILS', '#c78bff'], ['24 HR', '#3ef2a0'], ['BAIL BONDS', '#ffd23f'], ['CHECK CASH', '#3ec8ff'], ['LOWRIDERZ', '#ff4fd8'], ['CHICKEN', '#ff9a3c'],
    ['CELLULAR', '#3ec8ff'], ['TATTOO', '#ff3860'], ['DINER', '#ffd23f'], ['SNEAKERS', '#3ef2a0'], ['LAUNDRY', '#3ec8ff'], ['PIZZA', '#ff3860'], ['FISH FRY', '#ff9a3c'], ['LIQUOR', '#ff4fd8']];
  const DISTRICTS = [['Whisker Wharf', 'Palm Row', 'Tuna Town'], ['Lowrider Lane', 'Downtown Catz', 'Starlite Heights'], ['Catnip Alley', 'Fish Market', 'Sunset Strip']];

  const blocks = [];
  function mkBuilding(x, y, w, h) {
    const wall = pick(WALLS), s = pick(SIGNS);
    const b = { x, y, w, h, floors: 3 + Math.floor(rand() * 5), wall, wallIdx: WALLS.indexOf(wall), wallDark: shade(wall, 0.72), roof: shade(wall, 0.5), roofHi: shade(wall, 0.62), sign: s[0], signCol: s[1], acs: [], lit: [], seed: rand() };
    const nac = 1 + Math.floor(rand() * 3);
    for (let i = 0; i < nac; i++) b.acs.push({ x: 14 + rand() * (w - 60), y: 14 + rand() * Math.max(8, h - FH - 50), w: 26 + rand() * 18, h: 18 + rand() * 12 });
    const nw = Math.max(1, Math.floor((w - 24) / 48));
    for (let i = 0; i < nw; i++) b.lit.push(rand() < 0.45);
    b.door = rand() < 0.8 ? 18 + Math.floor(rand() * Math.max(1, nw)) * 48 : -1;
    b.awn = pick(['#e11d48', '#0ea5e9', '#16a34a', '#f59e0b', '#7c3aed']);
    return b;
  }
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const bx = i * P + R, by = j * P + R, r = rand();
    const b = { i, j, x: bx, y: by, type: r < 0.12 ? 'park' : r < 0.2 ? 'plaza' : 'bld', bs: [], trees: [], lamps: [], benches: [] };
    if (b.type === 'bld') {
      const ix = bx + SW, iy = by + SW, iw = B - 2 * SW, g = 8, m = rand();
      if (m < 0.3) b.bs.push(mkBuilding(ix, iy, iw, iw));
      else if (m < 0.55) { const w1 = Math.floor(iw * (0.4 + rand() * 0.2)); b.bs.push(mkBuilding(ix, iy, w1, iw), mkBuilding(ix + w1 + g, iy, iw - w1 - g, iw)); }
      else if (m < 0.75) { const h1 = Math.floor(iw * (0.42 + rand() * 0.16)); b.bs.push(mkBuilding(ix, iy, iw, h1), mkBuilding(ix, iy + h1 + g, iw, iw - h1 - g)); }
      else { const hw = Math.floor((iw - g) / 2); for (let a = 0; a < 2; a++) for (let c = 0; c < 2; c++) b.bs.push(mkBuilding(ix + c * (hw + g), iy + a * (hw + g), hw, hw)); }
    } else {
      const nt = b.type === 'park' ? 9 : 4;
      for (let t = 0; t < nt; t++) b.trees.push({ x: bx + SW + 30 + rand() * (B - 2 * SW - 60), y: by + SW + 30 + rand() * (B - 2 * SW - 60), s: 0.8 + rand() * 0.5, k: rand() });
      b.benches.push({ x: bx + B / 2 - 20, y: by + B / 2 + 40 });
    }
    // palms along the curb, lamps at the corners
    if (rand() < 0.7) for (let t = 70; t < B - 40; t += 120) { b.trees.push({ x: bx + t, y: by + 10, s: 1, k: rand(), palm: true }); }
    if (rand() < 0.5) for (let t = 70; t < B - 40; t += 120) { b.trees.push({ x: bx + t, y: by + B - 10, s: 1, k: rand(), palm: true }); }
    for (const [lx, ly] of [[bx + 6, by + 6], [bx + B - 6, by + 6], [bx + 6, by + B - 6], [bx + B - 6, by + B - 6]]) b.lamps.push({ x: lx, y: ly });
    for (const bd of b.bs) {
      const dN = bd.y - by, dS = by + B - (bd.y + bd.h), dW = bd.x - bx, dE = bx + B - (bd.x + bd.w), m = Math.min(dN, dS, dW, dE);
      bd.front = m === dN ? 'N' : m === dS ? 'S' : m === dW ? 'W' : 'E'; bd.doorU = 0.25 + rand() * 0.5;
    }
    blocks.push(b);
  }

  function edgePoint(i, j, side, t) {
    const bx = i * P + R, by = j * P + R, o = SW / 2;
    switch (side) {
      case 'N': return { x: bx + B * t, y: by + o };
      case 'S': return { x: bx + B * t, y: by + B - o };
      case 'W': return { x: bx + o, y: by + B * t };
      default: return { x: bx + B - o, y: by + B * t };
    }
  }
  // points of interest (shops, mission giver, mission spots)
  const POI = {
    home:    { name: 'SAFEHOUSE',     blk: [3, 3, 'S', 0.5], col: '#4fc3ff', icon: 'H' },
    og:      { name: 'OG WHISKERS',   blk: [3, 3, 'E', 0.4], col: '#ffd23f', icon: '!' },
    bodega:  { name: 'BODEGA',        blk: [4, 4, 'W', 0.5], col: '#3ef2a0', icon: 'B' },
    fits:    { name: 'FRESH FITS',    blk: [2, 4, 'N', 0.5], col: '#ff4fd8', icon: 'F' },
    spray:   { name: 'PAY-N-SPRAY',   blk: [5, 3, 'S', 0.5], col: '#ff9a3c', icon: 'S' },
    records: { name: 'RECORD SPOT',   blk: [1, 2, 'S', 0.5], col: '#c78bff', icon: 'R' },
    stash:   { name: 'STASH HOUSE',   blk: [6, 1, 'E', 0.5], col: '#ff3860', icon: '$' },
    docks:   { name: 'THE WHARF',     blk: [7, 7, 'S', 0.5], col: '#3ec8ff', icon: 'W' },
    jail:    { name: 'PRECINCT',      blk: [2, 2, 'S', 0.5], col: '#4f7cff', icon: 'P' },
    pawn:    { name: 'PAWN SHOP',     blk: [5, 5, 'N', 0.5], col: '#ffd23f', icon: 'G' },
  };
  for (const k in POI) {
    const p = POI[k], [i, j, s, t] = p.blk, pt = edgePoint(i, j, s, t);
    p.x = pt.x; p.y = pt.y; p.id = k;
    const blk = blocks[j * N + i];
    if (blk.type !== 'bld') { blk.type = 'bld'; blk.trees = blk.trees.filter(t => t.palm); blk.benches = []; const ix = blk.x + SW, iy = blk.y + SW, iw = B - 2 * SW; blk.bs.push(mkBuilding(ix, iy, iw, iw)); }
    let best = null, bd = 1e9;
    for (const b of blk.bs) { const cx = clamp(p.x, b.x, b.x + b.w), cy = clamp(p.y, b.y, b.y + b.h), d = Math.hypot(cx - p.x, cy - p.y); if (d < bd) { bd = d; best = b; } }
    if (best && k !== 'og' && k !== 'stash') { best.sign = p.name; best.signCol = p.col; best.poi = k; }
    if (best) { best.front = s; best.doorU = (s === 'N' || s === 'S') ? clamp((p.x - best.x) / best.w, 0.12, 0.88) : clamp((p.y - best.y) / best.h, 0.12, 0.88); if (k !== 'og') best.poiDoor = k; }
  }

  // ---------- geometry helpers ----------
  const center = k => k * P + R / 2;
  const roadK = v => { const k = Math.floor(v / P); return (k >= 0 && k <= N && v - k * P <= R) ? k : -1; };
  const isRoad = (x, y) => roadK(x) >= 0 || roadK(y) >= 0;
  function blockAt(x, y) {
    const i = Math.floor((x - R) / P), j = Math.floor((y - R) / P);
    if (i < 0 || j < 0 || i >= N || j >= N) return null;
    if ((x - R) - i * P > B || (y - R) - j * P > B) return null;
    return blocks[j * N + i];
  }
  function blockIdx(x, y) { return [clamp(Math.floor((x - R) / P), 0, N - 1), clamp(Math.floor((y - R) / P), 0, N - 1)]; }
  function nearBuildings(x, y, out) {
    out.length = 0;
    const [i0, j0] = blockIdx(x, y);
    for (let j = Math.max(0, j0 - 1); j <= Math.min(N - 1, j0 + 1); j++) for (let i = Math.max(0, i0 - 1); i <= Math.min(N - 1, i0 + 1); i++) for (const b of blocks[j * N + i].bs) out.push(b);
    return out;
  }
  const _nb = [];
  function buildingAt(x, y) {
    const bl = blockAt(x, y); if (!bl) return null;
    for (const b of bl.bs) if (x > b.x && x < b.x + b.w && y > b.y && y < b.y + b.h) return b;
    return null;
  }
  // push a circle out of buildings; returns {x,y,hit}
  function pushCircle(x, y, r) {
    let hit = false;
    nearBuildings(x, y, _nb);
    for (const b of _nb) {
      const cx = clamp(x, b.x, b.x + b.w), cy = clamp(y, b.y, b.y + b.h);
      let dx = x - cx, dy = y - cy, d2 = dx * dx + dy * dy;
      if (d2 < r * r) {
        hit = true;
        if (d2 < 0.0001) { // centre inside: exit via nearest edge
          const dl = x - b.x, dr = b.x + b.w - x, dt = y - b.y, db = b.y + b.h - y, m = Math.min(dl, dr, dt, db);
          if (m === dl) x = b.x - r; else if (m === dr) x = b.x + b.w + r; else if (m === dt) y = b.y - r; else y = b.y + b.h + r;
        } else { const d = Math.sqrt(d2); x = cx + dx / d * r; y = cy + dy / d * r; }
      }
    }
    x = clamp(x, 14, SIZE - 14); y = clamp(y, 14, SIZE - 14);
    return { x, y, hit };
  }
  function los(x0, y0, x1, y1) {
    const d = Math.hypot(x1 - x0, y1 - y0), n = Math.ceil(d / 36);
    for (let i = 1; i < n; i++) { const t = i / n; if (buildingAt(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t)) return false; }
    return true;
  }
  function districtAt(x, y) { const [i, j] = blockIdx(x, y); return DISTRICTS[Math.min(2, Math.floor(j * 3 / N))][Math.min(2, Math.floor(i * 3 / N))]; }
  function randomSidewalk(cx, cy, rad) {
    for (let t = 0; t < 8; t++) {
      const [i, j] = blockIdx(cx + (Math.random() * 2 - 1) * rad, cy + (Math.random() * 2 - 1) * rad);
      const p = edgePoint(i, j, ['N', 'S', 'W', 'E'][Math.floor(Math.random() * 4)], 0.06 + Math.random() * 0.88);
      return p;
    }
  }
  const rvec = d => [-DY[d], DX[d]];
  function lanePoint(node, d, ahead) {   // point on the lane of direction d, `ahead` px beyond the intersection centre
    const cx = center(node[0]), cy = center(node[1]), r = rvec(d);
    return { x: cx + DX[d] * ahead + r[0] * LO, y: cy + DY[d] * ahead + r[1] * LO };
  }
  // traffic signals: a 24 s cycle per intersection, offset so neighbouring lights form a loose green wave
  function signal(i, j, axis, t) {
    const cyc = 24, off = ((i * 3.7 + j * 5.3) % cyc + cyc) % cyc, ph = ((t + off) % cyc + cyc) % cyc, s = axis === 0 ? ph : (ph + 12) % cyc;
    return s < 9.5 ? 'G' : s < 12 ? 'Y' : 'R';
  }
  function nearestNode(x, y) { return [clamp(Math.round((x - R / 2) / P), 0, N), clamp(Math.round((y - R / 2) / P), 0, N)]; }

  // ---------- drawing ----------
  function drawGround(ctx, v) {
    // sea + sand
    const g = ctx.createLinearGradient(0, v.y0, 0, v.y1);
    g.addColorStop(0, '#0b7285'); g.addColorStop(1, '#0a5a7a');
    ctx.fillStyle = g; ctx.fillRect(v.x0, v.y0, v.x1 - v.x0, v.y1 - v.y0);
    ctx.fillStyle = '#e8d29a'; ctx.fillRect(-170, -170, SIZE + 340, SIZE + 340);
    ctx.fillStyle = '#f3e3b3'; ctx.fillRect(-120, -120, SIZE + 240, SIZE + 240);
    ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 5; ctx.strokeRect(-172, -172, SIZE + 344, SIZE + 344);
    // blocks (sidewalk + lot)
    const i0 = Math.max(0, Math.floor((v.x0 - R) / P)), i1 = Math.min(N - 1, Math.floor((v.x1 - R) / P));
    const j0 = Math.max(0, Math.floor((v.y0 - R) / P)), j1 = Math.min(N - 1, Math.floor((v.y1 - R) / P));
    // roads first (so block curbs sit on top)
    ctx.fillStyle = '#2a2c34';
    for (let k = 0; k <= N; k++) {
      if (k * P + R > v.x0 && k * P < v.x1) ctx.fillRect(k * P, 0, R, SIZE);
      if (k * P + R > v.y0 && k * P < v.y1) ctx.fillRect(0, k * P, SIZE, R);
    }
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const b = blocks[j * N + i];
      ctx.fillStyle = '#9a98a6'; ctx.fillRect(b.x, b.y, B, B);
      ctx.fillStyle = b.type === 'park' ? '#3f9b4a' : b.type === 'plaza' ? '#c9b99b' : '#6d6b78';
      ctx.fillRect(b.x + SW, b.y + SW, B - 2 * SW, B - 2 * SW);
      ctx.strokeStyle = '#5d5b68'; ctx.lineWidth = 4; ctx.strokeRect(b.x, b.y, B, B);
      // expansion joints
      ctx.strokeStyle = 'rgba(70,68,84,.55)'; ctx.lineWidth = 1.5; ctx.beginPath();
      for (let t = 38; t < B; t += 38) {
        ctx.moveTo(b.x + t, b.y); ctx.lineTo(b.x + t, b.y + SW); ctx.moveTo(b.x + t, b.y + B - SW); ctx.lineTo(b.x + t, b.y + B);
        ctx.moveTo(b.x, b.y + t); ctx.lineTo(b.x + SW, b.y + t); ctx.moveTo(b.x + B - SW, b.y + t); ctx.lineTo(b.x + B, b.y + t);
      }
      ctx.stroke();
      if (b.type === 'park') { // paths
        ctx.fillStyle = '#c9b99b'; ctx.fillRect(b.x + B / 2 - 12, b.y + SW, 24, B - 2 * SW); ctx.fillRect(b.x + SW, b.y + B / 2 - 12, B - 2 * SW, 24);
        for (const bn of b.benches) { ctx.fillStyle = '#7a4b2a'; ctx.fillRect(bn.x, bn.y, 40, 12); }
      } else if (b.type === 'plaza') {
        ctx.strokeStyle = 'rgba(0,0,0,.12)'; ctx.lineWidth = 1;
        for (let t = SW; t < B - SW; t += 30) { ctx.beginPath(); ctx.moveTo(b.x + t, b.y + SW); ctx.lineTo(b.x + t, b.y + B - SW); ctx.moveTo(b.x + SW, b.y + t); ctx.lineTo(b.x + B - SW, b.y + t); ctx.stroke(); }
        ctx.fillStyle = '#3aa6c9'; ctx.beginPath(); ctx.arc(b.x + B / 2, b.y + B / 2, 46, 0, 7); ctx.fill();
        ctx.fillStyle = '#9ad7ea'; ctx.beginPath(); ctx.arc(b.x + B / 2, b.y + B / 2, 30, 0, 7); ctx.fill();
      }
    }
    // road markings
    ctx.lineWidth = 3;
    for (let k = 0; k <= N; k++) {
      const c = center(k);
      for (let s = 0; s < N; s++) {              // segments between intersections
        const a = s * P + R, e = (s + 1) * P;
        if (k * P + R > v.x0 && k * P < v.x1 && e > v.y0 && a < v.y1) {   // vertical road k, segment s
          ctx.strokeStyle = '#e8b923'; ctx.beginPath(); ctx.moveTo(c - 3, a); ctx.lineTo(c - 3, e); ctx.moveTo(c + 3, a); ctx.lineTo(c + 3, e); ctx.stroke();
          ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.beginPath(); ctx.moveTo(k * P + 7, a); ctx.lineTo(k * P + 7, e); ctx.moveTo(k * P + R - 7, a); ctx.lineTo(k * P + R - 7, e); ctx.stroke();
        }
        if (k * P + R > v.y0 && k * P < v.y1 && e > v.x0 && a < v.x1) {   // horizontal road k, segment s
          ctx.strokeStyle = '#e8b923'; ctx.beginPath(); ctx.moveTo(a, c - 3); ctx.lineTo(e, c - 3); ctx.moveTo(a, c + 3); ctx.lineTo(e, c + 3); ctx.stroke();
          ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.beginPath(); ctx.moveTo(a, k * P + 7); ctx.lineTo(e, k * P + 7); ctx.moveTo(a, k * P + R - 7); ctx.lineTo(e, k * P + R - 7); ctx.stroke();
        }
      }
    }
    // crosswalks
    ctx.fillStyle = 'rgba(240,240,240,.75)';
    for (let a = 0; a <= N; a++) for (let b = 0; b <= N; b++) {
      const x = a * P, y = b * P;
      if (x + R + 40 < v.x0 || x - 40 > v.x1 || y + R + 40 < v.y0 || y - 40 > v.y1) continue;
      for (let t = 14; t < R - 10; t += 20) {
        if (b > 0) ctx.fillRect(x + t, y - 34, 10, 26);  if (b < N) ctx.fillRect(x + t, y + R + 8, 10, 26);   // N / S approach
        if (a > 0) ctx.fillRect(x - 34, y + t, 26, 10);  if (a < N) ctx.fillRect(x + R + 8, y + t, 26, 10);   // W / E approach
      }
    }
  }

  function drawBuilding(ctx, b) {
    ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.fillRect(b.x + 10, b.y + 16, b.w, b.h);
    const rh = b.h - FH;
    ctx.fillStyle = b.roof; ctx.fillRect(b.x, b.y, b.w, rh);
    ctx.fillStyle = b.roofHi; ctx.fillRect(b.x + 5, b.y + 5, b.w - 10, rh - 10);
    ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.fillRect(b.x + 5, b.y + rh - 10, b.w - 10, 5);
    for (const a of b.acs) { ctx.fillStyle = '#9aa0a6'; ctx.fillRect(b.x + a.x, b.y + a.y, a.w, a.h); ctx.fillStyle = '#c3c8cc'; ctx.fillRect(b.x + a.x, b.y + a.y, a.w, 5); ctx.fillStyle = '#5f6368'; ctx.beginPath(); ctx.arc(b.x + a.x + a.w / 2, b.y + a.y + a.h / 2 + 2, 6, 0, 7); ctx.fill(); }
    // facade
    ctx.fillStyle = b.wall; ctx.fillRect(b.x, b.y + rh, b.w, FH);
    ctx.fillStyle = b.wallDark; ctx.fillRect(b.x, b.y + rh, b.w, 6);
    ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(b.x, b.y + b.h - 4, b.w, 4);
    const nw = b.lit.length;
    for (let i = 0; i < nw; i++) {
      const wx = b.x + 12 + i * 48;
      if (wx + 30 > b.x + b.w - 6) break;
      if (b.door === 18 + i * 48) continue;
      ctx.fillStyle = b.lit[i] ? '#ffd98a' : '#1c2a3a'; ctx.fillRect(wx, b.y + rh + 12, 30, 20);
      ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.fillRect(wx + 14, b.y + rh + 12, 2, 20);
    }
    if (b.door >= 0 && b.x + b.door + 26 < b.x + b.w) {
      const dx = b.x + b.door - 6 + 4;
      ctx.fillStyle = '#2b1d14'; ctx.fillRect(dx, b.y + b.h - 34, 26, 30);
      ctx.fillStyle = b.awn; ctx.fillRect(dx - 6, b.y + b.h - 40, 38, 8);
      ctx.fillStyle = 'rgba(255,255,255,.7)'; for (let s = 0; s < 4; s++) ctx.fillRect(dx - 6 + s * 10, b.y + b.h - 40, 5, 8);
    }
    // neon sign board
    ctx.font = '900 15px "Arial Black", Impact, sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    const tw = ctx.measureText(b.sign).width + 14, sx = b.x + 8, sy = b.y + rh - 22;
    ctx.fillStyle = '#12101c'; ctx.fillRect(sx, sy, tw, 22);
    ctx.strokeStyle = b.signCol; ctx.lineWidth = 2; ctx.strokeRect(sx + 1, sy + 1, tw - 2, 20);
    ctx.fillStyle = b.signCol; ctx.fillText(b.sign, sx + 7, sy + 12);
    b._tw = tw;
  }
  function drawBuildings(ctx, v) {
    const i0 = Math.max(0, Math.floor((v.x0 - R) / P)), i1 = Math.min(N - 1, Math.floor((v.x1 - R) / P));
    const j0 = Math.max(0, Math.floor((v.y0 - R) / P)), j1 = Math.min(N - 1, Math.floor((v.y1 - R) / P));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) for (const b of blocks[j * N + i].bs) if (b.x < v.x1 && b.x + b.w + 16 > v.x0 && b.y < v.y1 && b.y + b.h + 16 > v.y0) drawBuilding(ctx, b);
  }
  // night glow: lit windows + neon signs
  function drawLights(ctx, v, dark) {
    const i0 = Math.max(0, Math.floor((v.x0 - R) / P)), i1 = Math.min(N - 1, Math.floor((v.x1 - R) / P));
    const j0 = Math.max(0, Math.floor((v.y0 - R) / P)), j1 = Math.min(N - 1, Math.floor((v.y1 - R) / P));
    ctx.globalCompositeOperation = 'lighter';
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const bl = blocks[j * N + i];
      for (const b of bl.bs) {
        if (b.x > v.x1 || b.x + b.w < v.x0 || b.y > v.y1 || b.y + b.h < v.y0) continue;
        const rh = b.h - FH;
        ctx.fillStyle = `rgba(255,200,110,${0.55 * dark})`;
        for (let w = 0; w < b.lit.length; w++) { const wx = b.x + 12 + w * 48; if (wx + 30 > b.x + b.w - 6 || !b.lit[w] || b.door === 18 + w * 48) continue; ctx.fillRect(wx - 1, b.y + rh + 11, 32, 22); }
        const tw = b._tw || 80, sx = b.x + 8, sy = b.y + rh - 22;
        const gr = ctx.createRadialGradient(sx + tw / 2, sy + 40, 4, sx + tw / 2, sy + 40, 90);
        gr.addColorStop(0, b.signCol + '55'); gr.addColorStop(1, b.signCol + '00');
        ctx.globalAlpha = dark; ctx.fillStyle = gr; ctx.fillRect(sx - 60, sy - 40, tw + 120, 170); ctx.globalAlpha = 1;
        ctx.fillStyle = b.signCol; ctx.globalAlpha = 0.35 * dark; ctx.fillRect(sx, sy, tw, 22); ctx.globalAlpha = 1;
      }
      for (const l of bl.lamps) {
        if (l.x < v.x0 - 60 || l.x > v.x1 + 60 || l.y < v.y0 - 60 || l.y > v.y1 + 60) continue;
        const gr = ctx.createRadialGradient(l.x, l.y, 2, l.x, l.y, 90);
        gr.addColorStop(0, `rgba(255,214,150,${0.32 * dark})`); gr.addColorStop(1, 'rgba(255,214,150,0)');
        ctx.fillStyle = gr; ctx.fillRect(l.x - 90, l.y - 90, 180, 180);
      }
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  // palms / lamps are drawn in the depth-sorted pass
  function decorList(v, out) {
    const i0 = Math.max(0, Math.floor((v.x0 - R - 80) / P)), i1 = Math.min(N - 1, Math.floor((v.x1 - R + 80) / P));
    const j0 = Math.max(0, Math.floor((v.y0 - R - 120) / P)), j1 = Math.min(N - 1, Math.floor((v.y1 - R + 120) / P));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const b = blocks[j * N + i];
      for (const t of b.trees) if (t.x > v.x0 - 80 && t.x < v.x1 + 80 && t.y > v.y0 - 20 && t.y < v.y1 + 160) out.push({ y: t.y, kind: 'tree', t });
      for (const l of b.lamps) if (l.x > v.x0 - 40 && l.x < v.x1 + 40 && l.y > v.y0 - 20 && l.y < v.y1 + 120) out.push({ y: l.y, kind: 'lamp', t: l });
    }
  }
  function drawDecor(ctx, d, time) {
    const t = d.t;
    ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(t.x + 6, t.y + 2, d.kind === 'tree' ? 18 * t.s : 6, d.kind === 'tree' ? 7 * t.s : 3, 0, 0, 7); ctx.fill();
    if (d.kind === 'lamp') {
      ctx.fillStyle = '#2c2c34'; ctx.fillRect(t.x - 2, t.y - 44, 4, 44);
      ctx.fillStyle = '#ffe9b0'; ctx.fillRect(t.x - 7, t.y - 48, 14, 5);
      return;
    }
    if (t.palm) {
      ctx.strokeStyle = '#7a5a36'; ctx.lineWidth = 6; ctx.lineCap = 'round';
      const sway = Math.sin(time * 1.2 + t.k * 9) * 3;
      ctx.beginPath(); ctx.moveTo(t.x, t.y); ctx.quadraticCurveTo(t.x + 6, t.y - 34, t.x + 4 + sway, t.y - 68); ctx.stroke();
      ctx.fillStyle = '#1f9d55';
      for (let a = 0; a < 7; a++) {
        const ang = a * (Math.PI * 2 / 7) + t.k, lx = t.x + 4 + sway + Math.cos(ang) * 34, ly = t.y - 68 + Math.sin(ang) * 15 + 4;
        ctx.beginPath(); ctx.moveTo(t.x + 4 + sway, t.y - 68); ctx.quadraticCurveTo((t.x + 4 + sway + lx) / 2, Math.min(t.y - 68, ly) - 14, lx, ly); ctx.quadraticCurveTo((t.x + 4 + sway + lx) / 2, Math.min(t.y - 68, ly) - 4, t.x + 4 + sway, t.y - 66); ctx.fill();
      }
      ctx.lineCap = 'butt';
    } else {
      ctx.fillStyle = '#5b3a1e'; ctx.fillRect(t.x - 4, t.y - 26 * t.s, 8, 26 * t.s);
      ctx.fillStyle = '#2f8f3f'; ctx.beginPath(); ctx.arc(t.x, t.y - 44 * t.s, 24 * t.s, 0, 7); ctx.fill();
      ctx.fillStyle = '#3fb552'; ctx.beginPath(); ctx.arc(t.x - 6, t.y - 50 * t.s, 15 * t.s, 0, 7); ctx.fill();
    }
  }

  // ---------- minimap ----------
  let mini = null; const MS = 0.2;
  function minimap() {
    if (mini) return mini;
    mini = document.createElement('canvas'); mini.width = mini.height = Math.ceil(SIZE * MS);
    const c = mini.getContext('2d'); c.scale(MS, MS);
    c.fillStyle = '#0b5a73'; c.fillRect(0, 0, SIZE, SIZE);
    c.fillStyle = '#d9c58f'; c.fillRect(0, 0, SIZE, SIZE);
    c.fillStyle = '#5b5e6b'; for (let k = 0; k <= N; k++) { c.fillRect(k * P, 0, R, SIZE); c.fillRect(0, k * P, SIZE, R); }
    for (const b of blocks) {
      c.fillStyle = b.type === 'park' ? '#2f7d3b' : '#34323f'; c.fillRect(b.x, b.y, B, B);
      for (const bd of b.bs) { c.fillStyle = bd.wall; c.fillRect(bd.x, bd.y, bd.w, bd.h); }
    }
    return mini;
  }
  return { N, R, B, P, SW, FH, LO, SIZE, DX, DY, POI, blocks, center, roadK, isRoad, blockAt, blockIdx, buildingAt, pushCircle, los, districtAt, randomSidewalk, edgePoint,
    lanePoint, rvec, nearestNode, signal, drawGround, drawBuildings, drawLights, decorList, drawDecor, minimap, MS, clamp };
})();
