// 愤怒的猪 3D - 建模层 v3.0
// 全部用 Three.js 几何体组合 + Canvas 程序化贴图，圆润卡通低多边形风格，原创美术。
const Models = {
  _texCache: {},

  // ---------- 程序化贴图 ----------
  canvasTex(key, size, drawFn) {
    if (this._texCache[key]) return this._texCache[key];
    const c = document.createElement('canvas');
    c.width = c.height = size;
    drawFn(c.getContext('2d'), size);
    const t = new THREE.CanvasTexture(c);
    this._texCache[key] = t;
    return t;
  },

  woodTex(base = '#C68642', dark = '#8F5A24') {
    return this.canvasTex('wood' + base, 128, (g, s) => {
      g.fillStyle = base; g.fillRect(0, 0, s, s);
      g.strokeStyle = dark; g.lineWidth = 3;
      for (let i = 0; i < 6; i++) { // 木纹
        g.beginPath();
        const y = (i + 0.5) * s / 6;
        g.moveTo(0, y);
        for (let x = 0; x <= s; x += 16) g.lineTo(x, y + Math.sin(x * 0.2 + i * 3) * 3);
        g.stroke();
      }
      g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 6; g.strokeRect(3, 3, s - 6, s - 6); // 边框
    });
  },

  stoneTex() {
    return this.canvasTex('stone', 128, (g, s) => {
      g.fillStyle = '#9A9A9A'; g.fillRect(0, 0, s, s);
      for (let i = 0; i < 260; i++) { // 噪点
        const v = 120 + Math.random() * 60 | 0;
        g.fillStyle = `rgb(${v},${v},${v})`;
        g.fillRect(Math.random() * s, Math.random() * s, 3, 3);
      }
      g.strokeStyle = 'rgba(0,0,0,0.4)'; g.lineWidth = 5; g.strokeRect(2, 2, s - 4, s - 4);
    });
  },

  iceTex() {
    return this.canvasTex('ice', 128, (g, s) => {
      const gr = g.createLinearGradient(0, 0, s, s);
      gr.addColorStop(0, '#BFEFFF'); gr.addColorStop(1, '#7FD4FF');
      g.fillStyle = gr; g.fillRect(0, 0, s, s);
      g.strokeStyle = 'rgba(255,255,255,0.85)'; g.lineWidth = 2;
      for (let i = 0; i < 5; i++) { // 冰晶纹
        g.beginPath();
        let x = Math.random() * s, y = Math.random() * s;
        g.moveTo(x, y);
        for (let j = 0; j < 4; j++) { x += (Math.random() - 0.5) * 60; y += (Math.random() - 0.5) * 60; g.lineTo(x, y); }
        g.stroke();
      }
      g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = 4; g.strokeRect(2, 2, s - 4, s - 4);
    });
  },

  tntTex() {
    return this.canvasTex('tnt', 128, (g, s) => {
      g.fillStyle = '#C0392B'; g.fillRect(0, 0, s, s);
      g.fillStyle = '#F5D76E'; g.fillRect(0, s * 0.32, s, s * 0.36);
      g.fillStyle = '#2C1A0E';
      g.font = `bold ${s * 0.3}px sans-serif`;
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('TNT', s / 2, s / 2); // 通用危险品字样，无品牌元素
      g.strokeStyle = 'rgba(0,0,0,0.4)'; g.lineWidth = 6; g.strokeRect(3, 3, s - 6, s - 6);
    });
  },

  crackTex(stage) { // stage 1/2 裂痕
    return this.canvasTex('crack' + stage, 128, (g, s) => {
      g.clearRect(0, 0, s, s);
      g.strokeStyle = 'rgba(20,10,5,0.85)'; g.lineWidth = 3;
      const cx = s / 2, cy = s / 2, n = 3 + stage * 2;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + stage;
        g.beginPath(); g.moveTo(cx, cy);
        let x = cx, y = cy;
        for (let j = 0; j < 3 + stage; j++) {
          x += Math.cos(a + (Math.random() - 0.5)) * s * 0.14;
          y += Math.sin(a + (Math.random() - 0.5)) * s * 0.14;
          g.lineTo(x, y);
        }
        g.stroke();
      }
    });
  },

  mat(color, opt = {}) {
    return new THREE.MeshPhongMaterial(Object.assign({ color, shininess: 35, specular: 0x333333 }, opt));
  },

  // ---------- 猪 ----------
  pigColors: {
    normal: { body: 0xFFB6C1, accent: 0xE8588A, belly: 0xFFF0E0 },
    speed:  { body: 0xFFE066, accent: 0xF5A623, belly: 0xFFF8DC },
    bomb:   { body: 0x3A3A3A, accent: 0x666666, belly: 0x4A4A4A },
  },

  createPig(type) {
    const g = new THREE.Group();
    const c = this.pigColors[type] || this.pigColors.normal;

    const body = new THREE.Mesh(new THREE.SphereGeometry(0.5, 28, 20), this.mat(c.body));
    body.scale.set(1, 0.85, 1.1);
    g.add(body); g.userData.body = body;

    const belly = new THREE.Mesh(new THREE.SphereGeometry(0.34, 18, 14), this.mat(c.belly, 20));
    belly.position.set(0, -0.16, 0.16); belly.scale.set(1, 0.6, 0.85);
    g.add(belly);

    const snout = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.19, 0.16, 16), this.mat(c.accent));
    snout.rotation.x = Math.PI / 2; snout.position.set(0, 0.02, 0.52);
    g.add(snout);
    [-0.07, 0.07].forEach(dx => {
      const n = new THREE.Mesh(new THREE.SphereGeometry(0.032, 8, 6), this.mat(0x1a1a1a, 5));
      n.position.set(dx, 0.02, 0.6); g.add(n);
    });

    [-0.2, 0.2].forEach(dx => {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.22, 8), this.mat(c.accent));
      ear.position.set(dx, 0.42, 0); ear.rotation.z = dx > 0 ? -0.35 : 0.35;
      g.add(ear);
    });

    g.userData.eyes = [];
    [-0.15, 0.15].forEach(dx => {
      const w = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 8), this.mat(0xffffff, 60));
      w.position.set(dx, 0.16, 0.44); g.add(w);
      const p = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), this.mat(0x1a1a1a, 5));
      p.position.set(dx, 0.16, 0.52); g.add(p);
      g.userData.eyes.push({ white: w, pupil: p });
    });

    const tail = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.035, 8, 16, Math.PI * 1.5), this.mat(c.accent));
    tail.position.set(0, 0.05, -0.52); tail.rotation.y = Math.PI / 2;
    g.add(tail);

    if (type === 'bomb') {
      const fuse = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.28, 8), this.mat(0x222222, 5));
      fuse.position.set(0, 0.58, 0); fuse.rotation.z = 0.2; g.add(fuse);
      const spark = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6),
        new THREE.MeshBasicMaterial({ color: 0xFF8833 }));
      spark.position.set(0.06, 0.74, 0); g.add(spark);
      g.userData.spark = spark;
    }
    if (type === 'speed') {
      [-0.06, 0.06].forEach(dx => {
        const tuft = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.2, 6), this.mat(c.accent));
        tuft.position.set(dx, 0.46, 0.08); tuft.rotation.x = -0.55;
        g.add(tuft);
      });
    }

    g.userData.type = 'pig'; g.userData.pigType = type;
    return g;
  },

  // ---------- 鸟 ----------
  createBird(kind) {
    const g = new THREE.Group();
    // 原创配色：飞鸟青绿 / 站鸟橙黄（与任何既有游戏角色无关）
    const bodyColor = kind === 'flying' ? 0x4CAF50 : 0xFF9800;
    const accent = kind === 'flying' ? 0x388E3C : 0xE65100;

    const body = new THREE.Mesh(new THREE.SphereGeometry(0.4, 22, 16), this.mat(bodyColor));
    body.scale.set(1, 0.92, 1.05);
    g.add(body); g.userData.body = body;

    const belly = new THREE.Mesh(new THREE.SphereGeometry(0.27, 16, 12), this.mat(0xF8F8F8, 20));
    belly.position.set(0, -0.11, 0.12); belly.scale.set(1, 0.7, 0.85);
    g.add(belly);

    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.22, 8), this.mat(0xFFC107));
    beak.rotation.x = Math.PI / 2; beak.position.set(0, -0.03, 0.42);
    g.add(beak);

    const crest = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.18, 6), this.mat(accent));
    crest.position.set(0, 0.4, -0.05); crest.rotation.x = -0.4;
    g.add(crest);

    g.userData.wings = [];
    [-0.36, 0.36].forEach(dx => {
      const wing = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 8), this.mat(accent, 20));
      wing.position.set(dx, 0.02, -0.02); wing.scale.set(0.3, 0.65, 1);
      g.add(wing); g.userData.wings.push(wing);
    });

    g.userData.eyes = [];
    [-0.13, 0.13].forEach(dx => {
      const w = new THREE.Mesh(new THREE.SphereGeometry(0.085, 12, 8), this.mat(0xffffff, 60));
      w.position.set(dx, 0.14, 0.34); g.add(w);
      const p = new THREE.Mesh(new THREE.SphereGeometry(0.042, 8, 6), this.mat(0x1a1a1a, 5));
      p.position.set(dx, 0.14, 0.41); g.add(p);
      g.userData.eyes.push({ white: w, pupil: p });
    });

    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.3, 6), this.mat(accent));
    tail.position.set(0, 0.05, -0.42); tail.rotation.x = Math.PI / 2 - 0.4;
    g.add(tail);

    g.userData.type = 'bird'; g.userData.birdKind = kind;
    return g;
  },

  // ---------- 建筑块 ----------
  createBlock(type, w, h, d) {
    const geo = new THREE.BoxGeometry(w, h, d);
    let material;
    if (type === 'ice') {
      material = new THREE.MeshPhongMaterial({
        map: this.iceTex(), color: 0xffffff, transparent: true, opacity: 0.82,
        shininess: 120, specular: 0x99ccff,
      });
    } else if (type === 'wood') {
      material = new THREE.MeshPhongMaterial({ map: this.woodTex(), shininess: 25 });
    } else if (type === 'stone') {
      material = new THREE.MeshPhongMaterial({ map: this.stoneTex(), shininess: 12, specular: 0x111111 });
    } else if (type === 'tnt') {
      material = new THREE.MeshPhongMaterial({ map: this.tntTex(), shininess: 30 });
    }
    const m = new THREE.Mesh(geo, material);
    m.userData.type = 'block'; m.userData.matType = type;
    m.userData.w = w; m.userData.h = h; m.userData.d = d;
    return m;
  },

  // 裂痕覆盖层（受伤阶段贴在块表面）
  addCrack(blockMesh, stage) {
    if (blockMesh.userData.crack) { blockMesh.remove(blockMesh.userData.crack); blockMesh.userData.crack = null; }
    const { w, h, d } = blockMesh.userData;
    const crack = new THREE.Mesh(
      new THREE.PlaneGeometry(Math.max(w, d) * 0.96, h * 0.96),
      new THREE.MeshBasicMaterial({ map: this.crackTex(stage), transparent: true, depthWrite: false })
    );
    crack.position.set(0, 0, (Math.max(w, d) === d ? d : w) / 2 + 0.005);
    blockMesh.add(crack);
    blockMesh.userData.crack = crack;
  },

  // ---------- 弹弓 ----------
  createSlingshot() {
    const g = new THREE.Group();
    const wood = this.mat(0x8B5A2B, 20);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.13, 1.0, 10), wood);
    trunk.position.y = -0.5; g.add(trunk);
    [-1, 1].forEach(s => {
      const fork = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.62, 10), wood);
      fork.position.set(s * 0.2, 0.18, 0);
      fork.rotation.z = -s * 0.5;
      g.add(fork);
    });
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.38, 0.18, 12), this.mat(0x6B4423, 15));
    base.position.y = -1.02; g.add(base);
    g.userData.forkL = new THREE.Vector3(-0.36, 0.42, 0);
    g.userData.forkR = new THREE.Vector3(0.36, 0.42, 0);
    return g;
  },

  // ---------- 环境件 ----------
  createHill(w, h, d, color = 0x7CB342) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), this.mat(color, 15));
    m.scale.set(w, h, d);
    m.userData.type = 'hill';
    return m;
  },

  createTree(scale = 1, leafColor = 0x4E7A3A) {
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 1.0, 8), this.mat(0x7A5230, 15));
    trunk.position.y = 0.5; g.add(trunk);
    [1.15, 0.9, 0.62].forEach((r, i) => {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(r * scale, 1.1, 9), this.mat(leafColor, 20));
      cone.position.y = 1.15 + i * 0.62;
      g.add(cone);
    });
    g.scale.setScalar(scale);
    return g;
  },

  createCactus(scale = 1) {
    const g = new THREE.Group();
    const green = this.mat(0x5D8A4A, 20);
    const main = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 1.6, 10), green);
    main.position.y = 0.8; g.add(main);
    [-1, 1].forEach(s => {
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.15, 0.7, 8), green);
      arm.position.set(s * 0.32, 0.75 + s * 0.12, 0);
      arm.rotation.z = s * 1.2;
      g.add(arm);
    });
    const top = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), green);
    top.position.y = 1.6; g.add(top);
    g.scale.setScalar(scale);
    return g;
  },

  createRock(scale = 1, color = 0x8D8D8D) {
    const m = new THREE.Mesh(new THREE.DodecahedronGeometry(0.5, 0), this.mat(color, 8));
    m.scale.set(scale, scale * 0.7, scale);
    m.rotation.y = Math.random() * 3;
    return m;
  },

  createSnowPine(scale = 1) {
    const g = this.createTree(scale, 0x3E6B4A);
    g.children.slice(1).forEach((cone, i) => {
      const snow = new THREE.Mesh(new THREE.ConeGeometry(0.5 * scale * (1 - i * 0.18), 0.35, 9),
        this.mat(0xF4FAFF, 25));
      snow.position.y = cone.position.y + 0.32;
      g.add(snow);
    });
    return g;
  },

  createIceSpike(scale = 1) {
    const m = new THREE.Mesh(new THREE.ConeGeometry(0.3, 1.4, 6),
      new THREE.MeshPhongMaterial({ color: 0xBFEFFF, transparent: true, opacity: 0.85, shininess: 120 }));
    m.position.y = 0.7;
    const g = new THREE.Group(); g.add(m); g.scale.setScalar(scale);
    return g;
  },

  createVolcanoRock(scale = 1) {
    const m = new THREE.Mesh(new THREE.DodecahedronGeometry(0.5, 0), this.mat(0x4A3730, 6));
    m.scale.set(scale, scale * 0.8, scale);
    return m;
  },

  createLavaPool(r = 2) {
    const m = new THREE.Mesh(new THREE.CircleGeometry(r, 24),
      new THREE.MeshBasicMaterial({ color: 0xFF5722 }));
    m.rotation.x = -Math.PI / 2;
    m.userData.isLava = true;
    return m;
  },

  createCloud(scale = 1) {
    const g = new THREE.Group();
    const mat = new THREE.MeshPhongMaterial({ color: 0xffffff, transparent: true, opacity: 0.92, shininess: 5 });
    [[0, 0, 0, 0.6], [0.55, 0.06, 0.1, 0.45], [-0.55, 0.02, -0.05, 0.48], [0.15, 0.3, -0.1, 0.4]].forEach(([x, y, z, r]) => {
      const s = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), mat);
      s.position.set(x, y, z); g.add(s);
    });
    g.scale.setScalar(scale);
    return g;
  },

  createFloatingIsland(r = 2.2, color = 0x7CB342) {
    const g = new THREE.Group();
    const top = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.55, r * 0.8, 12), this.mat(color, 18));
    g.add(top);
    const bottom = new THREE.Mesh(new THREE.ConeGeometry(r * 0.55, r * 1.1, 12), this.mat(0x8D6E63, 10));
    bottom.position.y = -r * 0.95; bottom.rotation.x = Math.PI;
    g.add(bottom);
    return g;
  },

  createMountain(scale = 1, color = 0x8E9EAB, snowTop = false) {
    const g = new THREE.Group();
    const m = new THREE.Mesh(new THREE.ConeGeometry(2.2, 3.2, 7), this.mat(color, 10));
    m.position.y = 1.6; g.add(m);
    if (snowTop) {
      const cap = new THREE.Mesh(new THREE.ConeGeometry(0.75, 1.1, 7), this.mat(0xF4FAFF, 25));
      cap.position.y = 2.7; g.add(cap);
    }
    g.scale.setScalar(scale);
    return g;
  },

  createSun(color = 0xFFD54F) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(1.6, 18, 12), new THREE.MeshBasicMaterial({ color }));
    m.userData.isSun = true;
    return m;
  },

  createGrassTuft(scale = 1, color = 0x69A84F) {
    const g = new THREE.Group();
    for (let i = 0; i < 4; i++) {
      const blade = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.4 + Math.random() * 0.25, 5), this.mat(color, 12));
      blade.position.set((Math.random() - 0.5) * 0.3, 0.2, (Math.random() - 0.5) * 0.3);
      blade.rotation.z = (Math.random() - 0.5) * 0.5;
      g.add(blade);
    }
    g.scale.setScalar(scale);
    return g;
  },

  createBone(scale = 1) {
    const g = new THREE.Group();
    const mat = this.mat(0xEDE0C8, 20);
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.9, 8), mat);
    shaft.rotation.z = Math.PI / 2; g.add(shaft);
    [-0.45, 0.45].forEach(x => {
      [-0.07, 0.07].forEach(y => {
        const knob = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 6), mat);
        knob.position.set(x, y, 0); g.add(knob);
      });
    });
    g.scale.setScalar(scale);
    return g;
  },

  // 碎片粒子用的小碎块
  createDebrisPiece(type) {
    const size = 0.09 + Math.random() * 0.12;
    let material;
    if (type === 'ice') material = new THREE.MeshPhongMaterial({ color: 0xBFEFFF, transparent: true, opacity: 0.85, shininess: 100 });
    else if (type === 'wood') material = this.mat(0xA9743B, 15);
    else if (type === 'stone') material = this.mat(0x8A8A8A, 8);
    else material = this.mat(0xC0392B, 20); // tnt
    return new THREE.Mesh(new THREE.BoxGeometry(size, size, size), material);
  },

  createFeather(color = 0xE8F5E9) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 4),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95 }));
    m.scale.set(1, 0.3, 1.8);
    return m;
  },

  createExplosionFX(radius) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(1, 18, 12),
      new THREE.MeshBasicMaterial({ color: 0xFFAB40, transparent: true, opacity: 0.85 }));
    m.scale.setScalar(radius * 0.3);
    m.userData.maxScale = radius;
    return m;
  },
};
if (typeof module !== 'undefined' && module.exports) module.exports = Models;
