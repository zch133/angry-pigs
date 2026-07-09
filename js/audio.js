// 愤怒的猪 3D - 音效系统 (PRD v2.1)
const Audio = {
  ctx: null,
  enabled: true,
  volume: 0.5,

  init() {
    if (!this.ctx) {
      try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); }
      catch (e) { this.enabled = false; }
    }
    if (this.ctx?.state === 'suspended') this.ctx.resume();
  },

  setVolume(v) { this.volume = Math.max(0, Math.min(1, v)); },

  tone(freq, dur, type = 'sine', vol = 0.3) {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(vol * this.volume, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
    o.connect(g); g.connect(this.ctx.destination);
    o.start(); o.stop(this.ctx.currentTime + dur);
  },

  slide(f1, f2, dur, type = 'sine', vol = 0.3) {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f1, this.ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(f2, this.ctx.currentTime + dur);
    g.gain.setValueAtTime(vol * this.volume, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
    o.connect(g); g.connect(this.ctx.destination);
    o.start(); o.stop(this.ctx.currentTime + dur);
  },

  stretch(power) { this.slide(100, 100 + power * 300, 0.1, 'square', 0.1); },
  launch() { this.slide(300, 800, 0.15, 'square', 0.2); },
  pigOink() { this.slide(300, 200, 0.1, 'sine', 0.2); },
  iceBreak() { this.tone(2000, 0.1, 'triangle', 0.15); this.tone(1500, 0.05, 'triangle', 0.1); },
  woodHit() { this.tone(200, 0.08, 'square', 0.2); },
  stoneHit() { this.tone(100, 0.12, 'sawtooth', 0.25); },
  birdHit() { this.slide(600, 200, 0.15, 'sawtooth', 0.2); this.tone(800, 0.1, 'square', 0.15); },
  boost() { this.slide(400, 1600, 0.2, 'sawtooth', 0.25); },
  explode() { this.tone(60, 0.3, 'sawtooth', 0.4); this.slide(200, 50, 0.4, 'square', 0.3); },
  combo(count) {
    const notes = [523, 659, 784, 1047, 1319];
    for (let i = 0; i < Math.min(count, 5); i++) {
      setTimeout(() => this.tone(notes[i], 0.1, 'square', 0.2), i * 60);
    }
    if (count >= 5) setTimeout(() => this.tone(2093, 0.3, 'sawtooth', 0.25), 300);
  },
  win() { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => this.tone(f, 0.15, 'sine', 0.3), i * 150)); },
  lose() { this.slide(400, 100, 0.5, 'sawtooth', 0.25); },
  click() { this.tone(600, 0.05, 'square', 0.15); },
};
