// 愤怒的猪 3D - 音效系统（PRD v2.1 对齐）

const AudioSystem = {
    ctx: null,
    enabled: true,
    volume: 0.5,

    init() {
        if (!this.ctx) {
            try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); }
            catch(e) { this.enabled = false; }
        }
        if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
    },

    setVolume(v) {
        this.volume = v;
    },

    tone(freq, dur, type = 'sine', vol = 0.3) {
        if (!this.enabled) return;
        this.init();
        if (!this.ctx) return;
        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        o.type = type;
        o.frequency.value = freq;
        g.gain.setValueAtTime(vol * this.volume, this.ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + dur);
        o.connect(g);
        g.connect(this.ctx.destination);
        o.start();
        o.stop(this.ctx.currentTime + dur);
    },

    slide(f1, f2, dur, type = 'sine', vol = 0.3) {
        if (!this.enabled) return;
        this.init();
        if (!this.ctx) return;
        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        o.type = type;
        o.frequency.setValueAtTime(f1, this.ctx.currentTime);
        o.frequency.exponentialRampToValueAtTime(Math.max(f2, 1), this.ctx.currentTime + dur);
        g.gain.setValueAtTime(vol * this.volume, this.ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + dur);
        o.connect(g);
        g.connect(this.ctx.destination);
        o.start();
        o.stop(this.ctx.currentTime + dur);
    },

    // 弹弓拉伸声：音调随力度上升
    stretch(power) {
        const freq = 150 + power * 250;
        this.slide(100, freq, 0.1, 'square', 0.1);
    },

    launch() {
        this.slide(400, 800, 0.1, 'sawtooth', 0.2);
        setTimeout(() => this.tone(600, 0.08, 'square', 0.15), 50);
    },

    pigOink() {
        this.slide(300, 200, 0.15, 'sine', 0.25);
        setTimeout(() => this.slide(280, 180, 0.12, 'sine', 0.2), 100);
    },

    iceBreak() {
        this.tone(2000, 0.05, 'triangle', 0.15);
        setTimeout(() => this.tone(1500, 0.03, 'triangle', 0.1), 30);
        setTimeout(() => this.tone(1000, 0.03, 'triangle', 0.08), 60);
    },

    woodHit() { this.tone(150, 0.08, 'square', 0.2); },
    stoneHit() { this.tone(80, 0.12, 'sawtooth', 0.25); },

    birdHit() {
        this.tone(600, 0.1, 'square', 0.2);
        setTimeout(() => this.slide(800, 200, 0.2, 'sawtooth', 0.2), 80);
    },

    birdChirp() {
        this.slide(800, 1200, 0.08, 'sine', 0.15);
        setTimeout(() => this.slide(1000, 600, 0.06, 'sine', 0.12), 60);
    },

    boost() { this.slide(400, 1600, 0.2, 'sawtooth', 0.25); },

    explode() {
        this.tone(60, 0.3, 'sawtooth', 0.4);
        setTimeout(() => this.slide(200, 50, 0.4, 'square', 0.3), 50);
    },

    // 连击音效
    combo(count) {
        if (count === 2) {
            this.tone(660, 0.1, 'sine', 0.2);
            setTimeout(() => this.tone(880, 0.1, 'sine', 0.2), 80);
        } else if (count === 3) {
            this.tone(660, 0.08, 'sine', 0.2);
            setTimeout(() => this.tone(880, 0.08, 'sine', 0.2), 60);
            setTimeout(() => this.tone(1100, 0.12, 'sine', 0.2), 120);
        } else if (count === 4) {
            [660, 880, 1100, 1320].forEach((f, i) => {
                setTimeout(() => this.tone(f, 0.08, 'square', 0.2), i * 50);
            });
        } else if (count >= 5) {
            [660, 880, 1100, 1320, 1760].forEach((f, i) => {
                setTimeout(() => this.tone(f, 0.1, 'square', 0.25), i * 60);
            });
            setTimeout(() => this.tone(2200, 0.3, 'sawtooth', 0.3), 300);
        }
    },

    win() {
        this.tone(523, 0.15, 'sine', 0.3);
        setTimeout(() => this.tone(659, 0.15, 'sine', 0.3), 150);
        setTimeout(() => this.tone(784, 0.15, 'sine', 0.3), 300);
        setTimeout(() => this.tone(1047, 0.3, 'sine', 0.3), 450);
    },

    lose() { this.slide(400, 100, 0.5, 'sawtooth', 0.25); },

    click() { this.tone(600, 0.05, 'square', 0.15); },
};
