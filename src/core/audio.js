export class GameAudio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.revGain = null;
    this.noiseBuf = null;
    this.musicTimer = null;
    this.musicGain = null;
    this.muted = false;
    try {
      this.muted = localStorage.getItem('lemonTdMuted') === '1';
    } catch (e) { /* ignore */ }
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      return true;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    try {
      this.ctx = new AC();
    } catch (e) {
      return false;
    }
    const ctx = this.ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0.0001 : 0.55;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.knee.value = 18;
    comp.ratio.value = 5;
    comp.attack.value = 0.004;
    comp.release.value = 0.22;
    this.master.connect(comp);
    comp.connect(ctx.destination);

    // simple generated reverb
    const len = Math.floor(ctx.sampleRate * 1.5);
    const imp = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = imp.getChannelData(c);
      for (let i = 0; i < len; i++) {
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6);
      }
    }
    const conv = ctx.createConvolver();
    conv.buffer = imp;
    this.revGain = ctx.createGain();
    this.revGain.gain.value = 0.32;
    this.revGain.connect(conv);
    conv.connect(this.master);

    const nlen = ctx.sampleRate * 1;
    this.noiseBuf = ctx.createBuffer(1, nlen, ctx.sampleRate);
    const nd = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < nlen; i++) nd[i] = Math.random() * 2 - 1;
    return true;
  }

  tone(t, { freq = 440, end = freq, type = 'sine', dur = 0.2, gain = 0.1, attack = 0.005, dest = null, rev = 0.18 }) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(Math.max(20, freq), t);
    if (end !== freq) o.frequency.exponentialRampToValueAtTime(Math.max(20, end), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(dest ?? this.master);
    if (!dest && this.revGain && rev > 0) {
      const send = ctx.createGain();
      send.gain.value = rev;
      g.connect(send);
      send.connect(this.revGain);
    }
    o.start(t);
    o.stop(t + dur + 0.03);
    return o;
  }

  noise(t, { dur = 0.2, gain = 0.1, type = 'lowpass', freq = 1200, end = freq, q = 1, attack = 0.004, dest = null, rev = 0 }) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.Q.value = q;
    f.frequency.setValueAtTime(Math.max(30, freq), t);
    if (end !== freq) f.frequency.exponentialRampToValueAtTime(Math.max(30, end), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f);
    f.connect(g);
    g.connect(dest ?? this.master);
    if (!dest && this.revGain && rev > 0) {
      const send = ctx.createGain();
      send.gain.value = rev;
      g.connect(send);
      send.connect(this.revGain);
    }
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  play(name) {
    if (this.muted) return;
    if (!this.ensure()) return;
    const t = this.ctx.currentTime;
    switch (name) {
      case 'arrow':
        this.noise(t, { dur: 0.09, gain: 0.13, type: 'highpass', freq: 1400, end: 2600, q: 0.7 });
        this.tone(t, { freq: 900, end: 300, type: 'triangle', dur: 0.1, gain: 0.05 });
        break;
      case 'cannon':
        this.tone(t, { freq: 130, end: 38, type: 'sine', dur: 0.34, gain: 0.3 });
        this.noise(t, { dur: 0.26, gain: 0.22, type: 'lowpass', freq: 900, end: 220, rev: 0.25 });
        break;
      case 'frost':
        this.tone(t, { freq: 1600, end: 420, type: 'sine', dur: 0.24, gain: 0.09 });
        this.noise(t, { dur: 0.3, gain: 0.1, type: 'highpass', freq: 2400, end: 900, rev: 0.3 });
        break;
      case 'arcane':
        this.tone(t, { freq: 740, end: 1180, type: 'sine', dur: 0.22, gain: 0.09, rev: 0.4 });
        this.tone(t, { freq: 1110, end: 1480, type: 'triangle', dur: 0.18, gain: 0.04, rev: 0.4 });
        break;
      case 'tesla':
        this.noise(t, { dur: 0.22, gain: 0.16, type: 'bandpass', freq: 2200, end: 700, q: 3 });
        this.tone(t, { freq: 1800, end: 240, type: 'sawtooth', dur: 0.16, gain: 0.07 });
        break;
      case 'hit':
        this.noise(t, { dur: 0.05, gain: 0.07, type: 'bandpass', freq: 1600, q: 1.2 });
        break;
      case 'magicHit':
        this.tone(t, { freq: 880, end: 1240, type: 'sine', dur: 0.14, gain: 0.06, rev: 0.4 });
        break;
      case 'explosion':
        this.tone(t, { freq: 96, end: 30, type: 'sine', dur: 0.55, gain: 0.34 });
        this.noise(t, { dur: 0.5, gain: 0.3, type: 'lowpass', freq: 1100, end: 160, rev: 0.35 });
        break;
      case 'freeze':
        this.noise(t, { dur: 0.4, gain: 0.14, type: 'highpass', freq: 3600, end: 1100, rev: 0.5 });
        this.tone(t, { freq: 2400, end: 800, type: 'sine', dur: 0.3, gain: 0.05 });
        break;
      case 'coin':
        this.tone(t, { freq: 1180, type: 'sine', dur: 0.08, gain: 0.06 });
        this.tone(t + 0.06, { freq: 1760, type: 'sine', dur: 0.1, gain: 0.05 });
        break;
      case 'build':
        this.tone(t, { freq: 210, end: 120, type: 'triangle', dur: 0.16, gain: 0.16 });
        this.noise(t, { dur: 0.12, gain: 0.12, type: 'lowpass', freq: 800, end: 300 });
        break;
      case 'upgrade':
        [660, 880, 1320].forEach((f, i) => this.tone(t + i * 0.07, { freq: f, type: 'triangle', dur: 0.18, gain: 0.08, rev: 0.4 }));
        break;
      case 'sell':
        this.tone(t, { freq: 520, end: 300, type: 'triangle', dur: 0.16, gain: 0.07 });
        break;
      case 'error':
        this.tone(t, { freq: 160, end: 120, type: 'square', dur: 0.13, gain: 0.06 });
        this.tone(t + 0.1, { freq: 120, end: 90, type: 'square', dur: 0.13, gain: 0.05 });
        break;
      case 'wave':
        [196, 247, 294, 392].forEach((f, i) => this.tone(t + i * 0.05, { freq: f, type: 'sawtooth', dur: 0.9, gain: 0.045, attack: 0.06, rev: 0.5 }));
        this.noise(t, { dur: 0.7, gain: 0.08, type: 'lowpass', freq: 500, end: 120, rev: 0.4 });
        break;
      case 'leak':
        this.tone(t, { freq: 190, end: 55, type: 'sine', dur: 0.35, gain: 0.22 });
        this.noise(t, { dur: 0.25, gain: 0.14, type: 'lowpass', freq: 600, end: 150 });
        break;
      case 'victory':
        [523, 659, 784, 1046].forEach((f, i) => this.tone(t + i * 0.13, { freq: f, type: 'triangle', dur: 0.8, gain: 0.09, rev: 0.6 }));
        break;
      case 'defeat':
        [392, 330, 262, 196].forEach((f, i) => this.tone(t + i * 0.16, { freq: f, type: 'sawtooth', dur: 0.7, gain: 0.06, rev: 0.5 }));
        break;
      case 'click':
        this.tone(t, { freq: 620, type: 'sine', dur: 0.05, gain: 0.05 });
        break;
      case 'boss':
        this.tone(t, { freq: 60, end: 42, type: 'sawtooth', dur: 1.2, gain: 0.18, attack: 0.1, rev: 0.4 });
        this.noise(t, { dur: 1.0, gain: 0.1, type: 'lowpass', freq: 300, end: 90, attack: 0.1 });
        break;
      default:
        break;
    }
  }

  startMusic() {
    if (!this.ensure() || this.musicTimer) return;
    const ctx = this.ctx;
    this.musicGain = ctx.createGain();
    this.musicGain.gain.value = 0.55;
    this.musicGain.connect(this.master);
    const chords = [
      [196, 246.9, 293.7],
      [174.6, 220, 261.6],
      [146.8, 196, 246.9],
      [174.6, 220, 293.7],
    ];
    let step = 0;
    const play = () => {
      if (!this.ctx) return;
      const t = ctx.currentTime + 0.05;
      const ch = chords[step % chords.length];
      step++;
      for (const f of ch) {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'sine';
        o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.028, t + 4.5);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 10);
        o.connect(g);
        g.connect(this.musicGain);
        o.start(t);
        o.stop(t + 10.2);
      }
      const notes = [587.3, 659.3, 784, 880, 987.8];
      const nf = notes[Math.floor(Math.random() * notes.length)];
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'triangle';
      o.frequency.value = nf;
      g.gain.setValueAtTime(0.0001, t + 2);
      g.gain.exponentialRampToValueAtTime(0.012, t + 2.05);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 4.5);
      o.connect(g);
      g.connect(this.revGain);
      o.start(t + 2);
      o.stop(t + 4.6);
    };
    play();
    this.musicTimer = setInterval(play, 9000);
  }

  stopMusic() {
    if (this.musicTimer) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
    if (this.musicGain) {
      this.musicGain.gain.value = 0;
      this.musicGain = null;
    }
  }

  setMuted(m) {
    this.muted = m;
    try { localStorage.setItem('lemonTdMuted', m ? '1' : '0'); } catch (e) { /* ignore */ }
    if (this.master) {
      const t = this.ctx.currentTime;
      this.master.gain.cancelScheduledValues(t);
      this.master.gain.setTargetAtTime(m ? 0.0001 : 0.55, t, 0.05);
    }
    if (!m) this.ensure();
  }

  toggle() {
    this.setMuted(!this.muted);
    return this.muted;
  }
}
