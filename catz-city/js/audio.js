// Synthesised sound: sfx, engine, sirens and two 90s-style radio stations (boom bap + g-funk). No audio files.
const Snd = (() => {
  let ctx = null, master, sfxBus, musicBus, noiseBuf, muted = false;
  let engO1, engO2, engG, engF, skidG, sirenO, sirenG, ambG;
  const mf = m => 440 * Math.pow(2, (m - 69) / 12);
  const RADIO = { station: 0, step: 0, base: 0, timer: null, on: false };
  const NAMES = ['WKAT 90.9 · BOOM BAP CLASSICS', 'LOWRIDER FM · G-FUNK SUNSET', 'RADIO OFF'];

  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = muted ? 0 : 0.85; master.connect(ctx.destination);
    sfxBus = ctx.createGain(); sfxBus.gain.value = 0.9; sfxBus.connect(master);
    musicBus = ctx.createGain(); musicBus.gain.value = 0.5; musicBus.connect(master);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    // engine
    engO1 = ctx.createOscillator(); engO1.type = 'sawtooth'; engO2 = ctx.createOscillator(); engO2.type = 'square';
    engF = ctx.createBiquadFilter(); engF.type = 'lowpass'; engF.frequency.value = 500; engG = ctx.createGain(); engG.gain.value = 0;
    engO1.connect(engF); engO2.connect(engF); engF.connect(engG); engG.connect(sfxBus); engO1.start(); engO2.start();
    // tyre squeal
    const sk = ctx.createBufferSource(); sk.buffer = noiseBuf; sk.loop = true;
    const skf = ctx.createBiquadFilter(); skf.type = 'bandpass'; skf.frequency.value = 2400; skf.Q.value = 6;
    skidG = ctx.createGain(); skidG.gain.value = 0; sk.connect(skf); skf.connect(skidG); skidG.connect(sfxBus); sk.start();
    // siren
    sirenO = ctx.createOscillator(); sirenO.type = 'sawtooth'; sirenG = ctx.createGain(); sirenG.gain.value = 0;
    const sf = ctx.createBiquadFilter(); sf.type = 'lowpass'; sf.frequency.value = 1800;
    sirenO.connect(sf); sf.connect(sirenG); sirenG.connect(sfxBus); sirenO.start();
    // city ambience
    const am = ctx.createBufferSource(); am.buffer = noiseBuf; am.loop = true;
    const amf = ctx.createBiquadFilter(); amf.type = 'lowpass'; amf.frequency.value = 380; ambG = ctx.createGain(); ambG.gain.value = 0.05;
    am.connect(amf); amf.connect(ambG); ambG.connect(sfxBus); am.start();
    setRadio(RADIO.station, true);
  }

  function tone(f, dur, type, vol, slide, when, dest, cutoff) {
    if (!ctx) return; const t = when || ctx.currentTime;
    const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type || 'square';
    o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, slide), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let out = g; if (cutoff) { const f2 = ctx.createBiquadFilter(); f2.type = 'lowpass'; f2.frequency.value = cutoff; g.connect(f2); out = f2; }
    o.connect(g); out.connect(dest || sfxBus); o.start(t); o.stop(t + dur + 0.05);
  }
  function noise(dur, vol, f0, f1, type, when, dest, q) {
    if (!ctx) return; const t = when || ctx.currentTime;
    const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = ctx.createBiquadFilter(); f.type = type || 'bandpass'; f.frequency.setValueAtTime(f0, t); if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + dur); if (q) f.Q.value = q;
    const g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(dest || sfxBus); s.start(t, Math.random() * 1.2); s.stop(t + dur + 0.05);
  }
  const sfx = {
    punch() { noise(0.09, 0.5, 900, 300, 'bandpass'); tone(150, 0.1, 'sine', 0.5, 60); },
    whoosh() { noise(0.12, 0.18, 400, 1800, 'bandpass'); },
    hit() { noise(0.12, 0.6, 1200, 200, 'lowpass'); tone(110, 0.14, 'sawtooth', 0.35, 45); },
    crash(v) { v = Math.min(1, v || 0.5); noise(0.4, 0.7 * v, 2200, 200, 'lowpass'); tone(90, 0.3, 'sawtooth', 0.4 * v, 35); noise(0.15, 0.4 * v, 5000, 1500, 'highpass'); },
    boom() { noise(1.2, 0.95, 900, 40, 'lowpass'); tone(70, 0.9, 'sawtooth', 0.7, 25); },
    cash() { tone(880, 0.09, 'square', 0.18); tone(1318, 0.18, 'square', 0.18, 0, ctx && ctx.currentTime + 0.08); },
    buy() { tone(660, 0.08, 'triangle', 0.25); tone(990, 0.14, 'triangle', 0.25, 0, ctx && ctx.currentTime + 0.07); },
    door() { noise(0.08, 0.35, 700, 300, 'lowpass'); tone(200, 0.06, 'square', 0.2, 120); },
    horn() { tone(392, 0.45, 'sawtooth', 0.25, 0, 0, 0, 1500); tone(494, 0.45, 'sawtooth', 0.2, 0, 0, 0, 1500); },
    wasted() { [392, 311, 233, 175].forEach((f, i) => tone(f, 0.5, 'sawtooth', 0.28, f * 0.97, ctx.currentTime + i * 0.28, 0, 900)); },
    busted() { [330, 330, 262, 196].forEach((f, i) => tone(f, 0.25, 'square', 0.25, 0, ctx.currentTime + i * 0.2, 0, 1400)); },
    pass() { [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(f, 0.28, 'triangle', 0.3, 0, ctx.currentTime + i * 0.12)); },
    fail() { [300, 250, 200].forEach((f, i) => tone(f, 0.3, 'square', 0.22, f * 0.8, ctx.currentTime + i * 0.18, 0, 1000)); },
    blip() { tone(1200, 0.04, 'square', 0.1); },
  };
  function play(n, a) { if (!ctx || muted) return; try { sfx[n](a); } catch (e) { /* ignore */ } }

  function engine(speed, thr, on) {
    if (!ctx) return; const t = ctx.currentTime;
    const f = 42 + speed * 0.2 + thr * 12;
    engO1.frequency.setTargetAtTime(f, t, 0.05); engO2.frequency.setTargetAtTime(f * 0.5, t, 0.05);
    engF.frequency.setTargetAtTime(380 + speed * 1.6, t, 0.08);
    engG.gain.setTargetAtTime(on ? 0.05 + thr * 0.05 + Math.min(0.05, speed / 9000) : 0, t, 0.08);
  }
  function skid(v) { if (ctx) skidG.gain.setTargetAtTime(Math.min(0.12, v * 0.12), ctx.currentTime, 0.04); }
  function siren(vol) {
    if (!ctx) return; const t = ctx.currentTime;
    sirenO.frequency.setTargetAtTime(760 + 340 * Math.sin(t * 7), t, 0.02);
    sirenG.gain.setTargetAtTime(Math.min(0.09, vol * 0.09), t, 0.1);
  }
  function amb(v) { if (ctx) ambG.gain.setTargetAtTime(0.035 + v * 0.03, ctx.currentTime, 0.5); }

  // ---------- radio ----------
  const drum = {
    kick(t, v) { tone(130, 0.22, 'sine', 0.75 * v, 42, t, musicBus); },
    snare(t, v) { noise(0.16, 0.34 * v, 1900, 900, 'bandpass', t, musicBus, 0.7); tone(200, 0.1, 'triangle', 0.3 * v, 120, t, musicBus); },
    hat(t, v, open) { noise(open ? 0.22 : 0.05, 0.12 * v, 8000, 0, 'highpass', t, musicBus); },
    clap(t, v) { for (let i = 0; i < 3; i++) noise(0.05, 0.22 * v, 1500, 0, 'bandpass', t + i * 0.012, musicBus, 1.2); noise(0.14, 0.14 * v, 1500, 0, 'bandpass', t + 0.036, musicBus, 1.2); },
  };
  const BB = { bpm: 88, sw: 0.2,
    chords: [[57, 60, 64, 67], [50, 57, 60, 65], [55, 59, 62, 65], [48, 55, 59, 64]], bass: [33, 26, 31, 36] };
  const GF = { bpm: 94, sw: 0.12,
    chords: [[58, 62, 65, 69], [60, 63, 67, 70], [62, 66, 69, 72], [58, 62, 65, 69]], bass: [31, 36, 38, 31] };

  function stepBoomBap(s, t, bar) {
    const c = bar % 4, ch = BB.chords[c], q = 60 / BB.bpm / 4;
    if ([0, 7, 10].includes(s) || (bar % 2 && s === 13)) drum.kick(t, 1);
    if (s === 4 || s === 12) drum.snare(t, 1);
    if (s % 2 === 0) drum.hat(t, s % 4 === 0 ? 0.9 : 0.5, s === 14 && bar % 2);
    if ([0, 6, 10].includes(s)) ch.forEach((n, i) => tone(mf(n + 12), 0.32, 'triangle', 0.075, 0, t + i * 0.006, musicBus, 2200));
    if ([0, 3, 10, 14].includes(s)) tone(mf(BB.bass[c] + (s === 3 ? 12 : s === 14 ? 7 : 0)), q * 2.6, 'sine', 0.5, 0, t, musicBus);
    if (Math.random() < 0.1) noise(0.012, 0.15, 6000, 0, 'highpass', t, musicBus);            // vinyl crackle
    if (s === 8 && bar % 4 === 3) tone(mf(ch[2] + 24), q * 3, 'sine', 0.06, mf(ch[2] + 24) * 0.97, t, musicBus);
  }
  function stepGFunk(s, t, bar) {
    const c = bar % 4, ch = GF.chords[c], q = 60 / GF.bpm / 4;
    if ([0, 6, 10].includes(s)) drum.kick(t, 1);
    if (s === 4 || s === 12) { drum.snare(t, 0.8); drum.clap(t, 0.9); }
    drum.hat(t, s % 2 ? 0.25 : 0.45, s === 6 || s === 14);
    if ([0, 3, 6, 8, 11, 14].includes(s)) { const n = GF.bass[c] + ([3, 11].includes(s) ? 12 : s === 14 ? 7 : 0); tone(mf(n), q * 1.8, 'sawtooth', 0.22, 0, t, musicBus, 420); }
    if ([2, 10].includes(s)) ch.forEach((n, i) => tone(mf(n + 12), 0.2, 'square', 0.04, 0, t + i * 0.004, musicBus, 1800));
    if (s === 0) { const n = ch[3] + 12, f = mf(n); tone(f * 0.94, q * 8, 'sine', 0.13, f, t, musicBus); tone(f * 2.002, q * 8, 'sine', 0.03, f * 2, t, musicBus); }
    if (s === 8 && bar % 2) { const f = mf(ch[1] + 24); tone(f, q * 6, 'sine', 0.11, f * 1.03, t, musicBus); }
  }
  function schedule() {
    if (!ctx || !RADIO.on) return;
    const st = RADIO.station === 0 ? BB : GF, q = 60 / st.bpm / 4;
    while (RADIO.base < ctx.currentTime + 0.15) {
      const s = RADIO.step % 16, bar = Math.floor(RADIO.step / 16), t = RADIO.base + (s % 2 ? q * st.sw : 0);
      (RADIO.station === 0 ? stepBoomBap : stepGFunk)(s, t, bar);
      RADIO.step++; RADIO.base += q;
    }
  }
  function setRadio(n, silent) {
    RADIO.station = n; RADIO.step = 0;
    if (!ctx) return NAMES[n];
    clearInterval(RADIO.timer);
    RADIO.on = n < 2;
    if (RADIO.on) { RADIO.base = ctx.currentTime + 0.1; RADIO.timer = setInterval(schedule, 30); }
    return NAMES[n];
  }
  let listening = false;
  function radioListen(on) { if (!ctx) return; listening = on; musicBus.gain.setTargetAtTime(on ? 0.6 : 0.0, ctx.currentTime, 0.15); }
  function nextStation() { const n = (RADIO.station + 1) % 3; setRadio(n); return NAMES[n]; }
  function mute(m) { muted = m === undefined ? !muted : m; if (ctx) master.gain.value = muted ? 0 : 0.85; return muted; }
  return { init, play, engine, skid, siren, amb, setRadio, nextStation, radioListen, mute, get station() { return RADIO.station; }, names: NAMES, get ready() { return !!ctx; } };
})();
