// 愤怒的猪 3D - 音效系统 v3.0
// 全部由 Web Audio API 程序化合成：零外部音频文件、零版权风险。卡通风格。
const Audio = {
  ctx: null,
  enabled: true,
  volume: 0.5,
  _stretchOsc: null,
  _stretchGain: null,
  _noiseBuf: null,

  init() {
    if (!this.ctx) {
      try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); }
      catch (e) { this.enabled = false; }
    }
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  },

  setVolume(v) { this.volume = Math.max(0, Math.min(1, v)); },

  // 基础：固定音
  tone(freq, dur, type = 'sine', vol = 0.3, delay = 0) {
    if (!this.enabled) return;
    this.init(); if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(vol * this.volume, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.ctx.destination);
    o.start(t); o.stop(t + dur + 0.02);
  },

  // 基础：滑音
  slide(f1, f2, dur, type = 'sine', vol = 0.3, delay = 0) {
    if (!this.enabled) return;
    this.init(); if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f1, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(f2, 1), t + dur);
    g.gain.setValueAtTime(vol * this.volume, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.ctx.destination);
    o.start(t); o.stop(t + dur + 0.02);
  },

  // 噪声爆发（爆炸/碎裂质感）
  noise(dur, vol = 0.4, lowpass = 3000, delay = 0) {
    if (!this.enabled) return;
    this.init(); if (!this.ctx) return;
    if (!this._noiseBuf) {
      const len = this.ctx.sampleRate * 1;
      this._noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this._noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    const t = this.ctx.currentTime + delay;
    const src = this.ctx.createBufferSource();
    src.buffer = this._noiseBuf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.setValueAtTime(lowpass, t);
    f.frequency.exponentialRampToValueAtTime(120, t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol * this.volume, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f); f.connect(g); g.connect(this.ctx.destination);
    src.start(t); src.stop(t + dur + 0.02);
  },

  // ===== 弹弓拉伸：持续音，音调随力度上升（拖拽中每帧调用） =====
  stretchStart() {
    if (!this.enabled) return;
    this.init(); if (!this.ctx || this._stretchOsc) return;
    this._stretchOsc = this.ctx.createOscillator();
    this._stretchGain = this.ctx.createGain();
    this._stretchOsc.type = 'sawtooth';
    this._stretchOsc.frequency.value = 70;
    this._stretchGain.gain.value = 0;
    this._stretchOsc.connect(this._stretchGain);
    this._stretchGain.connect(this.ctx.destination);
    this._stretchOsc.start();
  },
  stretchUpdate(power01) {
    if (!this._stretchOsc || !this.ctx) return;
    this._stretchOsc.frequency.setTargetAtTime(70 + power01 * 260, this.ctx.currentTime, 0.03);
    this._stretchGain.gain.setTargetAtTime(0.05 * this.volume * Math.min(power01 * 2, 1), this.ctx.currentTime, 0.03);
  },
  stretchStop() {
    if (!this._stretchOsc || !this.ctx) return;
    try {
      this._stretchGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.02);
      this._stretchOsc.stop(this.ctx.currentTime + 0.1);
    } catch (e) {}
    this._stretchOsc = null; this._stretchGain = null;
  },

  // ===== 事件音效 =====
  launch(power01 = 1) {
    this.slide(250, 700 + power01 * 500, 0.16, 'square', 0.2);
    this.noise(0.12, 0.12, 2500);
  },
  pigOink() {
    this.slide(320, 180, 0.09, 'sine', 0.22);
    this.slide(380, 220, 0.08, 'sine', 0.15, 0.08);
  },
  pigWeew() { // 飞速猪冲刺
    this.slide(300, 1500, 0.35, 'sawtooth', 0.2);
  },
  // 材质撞击：speed 决定响度
  iceHit(spd = 5) { const v = Math.min(0.05 + spd * 0.02, 0.3); this.tone(2200, 0.08, 'triangle', v); this.tone(1600, 0.05, 'triangle', v * 0.7, 0.02); },
  iceBreak() { this.noise(0.18, 0.25, 6000); this.tone(2400, 0.12, 'triangle', 0.2); this.tone(1800, 0.1, 'triangle', 0.15, 0.03); },
  woodHit(spd = 5) { const v = Math.min(0.06 + spd * 0.022, 0.35); this.tone(180, 0.07, 'square', v); this.noise(0.05, v * 0.6, 1200); },
  woodBreak() { this.noise(0.2, 0.3, 1800); this.tone(140, 0.12, 'square', 0.25); this.tone(90, 0.15, 'square', 0.2, 0.04); },
  stoneHit(spd = 5) { const v = Math.min(0.07 + spd * 0.02, 0.4); this.tone(85, 0.12, 'sawtooth', v); this.noise(0.06, v * 0.5, 700); },
  stoneBreak() { this.noise(0.3, 0.38, 900); this.tone(60, 0.25, 'sawtooth', 0.35); },
  tntExplode() { this.explode(); },
  birdHit() { this.slide(700, 250, 0.14, 'sawtooth', 0.22); this.tone(900, 0.08, 'square', 0.16, 0.02); },
  birdDown() { this.slide(600, 150, 0.3, 'square', 0.25); this.tone(1200, 0.12, 'sine', 0.2, 0.1); },
  birdChirp() { this.tone(1800 + Math.random() * 600, 0.06, 'sine', 0.08); },
  boost() { this.pigWeew(); this.noise(0.25, 0.15, 4000); },
  explode() {
    this.tone(55, 0.4, 'sawtooth', 0.45);
    this.slide(220, 40, 0.45, 'square', 0.35);
    this.noise(0.5, 0.5, 2500);
  },
  combo(count) {
    const notes = [523, 659, 784, 1047, 1319];
    const n = Math.min(count, 5);
    for (let i = 0; i < n; i++) this.tone(notes[i], 0.1, 'square', 0.2, i * 0.06);
    if (count >= 5) this.tone(2093, 0.35, 'sawtooth', 0.25, 0.32);
  },
  star(i) { this.tone(700 + i * 250, 0.18, 'sine', 0.25); },
  win() { [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.16, 'sine', 0.28, i * 0.14)); },
  lose() { this.slide(400, 90, 0.6, 'sawtooth', 0.25); },
  click() { this.tone(600, 0.05, 'square', 0.15); },
  swoosh() { this.noise(0.15, 0.1, 3000); },
  bump() { this.tone(120, 0.06, 'sine', 0.15); }, // 落地闷响
};
if (typeof module !== 'undefined' && module.exports) module.exports = Audio;
