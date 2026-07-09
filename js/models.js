// 愤怒的猪 3D - 角色建模 (PRD v2.1)
const Models = {
  pigColors: {
    normal: { body: 0xFFB6C1, accent: 0xE8588A, belly: 0xFFF0E0 },
    speed:  { body: 0xFFE066, accent: 0xFFA500, belly: 0xFFF8DC },
    bomb:   { body: 0x2C2C2C, accent: 0x555555, belly: 0x444444 },
  },

  createPig(type) {
    const g = new THREE.Group();
    const c = this.pigColors[type] || this.pigColors.normal;
    const mat = (color, shininess = 40) => new THREE.MeshPhongMaterial({ color, shininess, specular: 0x333333 });

    // 身体
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.5, 32, 24), mat(c.body));
    body.scale.set(1, 0.85, 1.1);
    body.castShadow = true;
    g.add(body);

    // 肚子
    const belly = new THREE.Mesh(new THREE.SphereGeometry(0.35, 20, 16), mat(c.belly, 20));
    belly.position.set(0, -0.15, 0.15);
    belly.scale.set(1, 0.6, 0.8);
    g.add(belly);

    // 鼻子
    const snout = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.2, 0.15, 16), mat(c.accent));
    snout.rotation.x = Math.PI / 2;
    snout.position.set(0, 0, 0.5);
    g.add(snout);
    [(-0.07), 0.07].forEach(dx => {
      const nostril = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), mat(0x000000, 0));
      nostril.position.set(dx, 0, 0.57);
      g.add(nostril);
    });

    // 耳朵
    [(-0.2), 0.2].forEach(dx => {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.2, 8), mat(c.accent));
      ear.position.set(dx, 0.4, 0);
      ear.rotation.z = dx > 0 ? -0.3 : 0.3;
      g.add(ear);
    });

    // 眼睛
    [(-0.15), 0.15].forEach(dx => {
      const eyeWhite = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 8), mat(0xFFFFFF, 60));
      eyeWhite.position.set(dx, 0.15, 0.42);
      g.add(eyeWhite);
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), mat(0x000000, 0));
      pupil.position.set(dx, 0.15, 0.5);
      g.add(pupil);
      g.userData.eyes = g.userData.eyes || [];
      g.userData.eyes.push({ white: eyeWhite, pupil: pupil });
    });

    // 尾巴
    const tail = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.04, 8, 16, Math.PI), mat(c.accent));
    tail.position.set(0, 0, -0.5);
    tail.rotation.y = Math.PI / 2;
    g.add(tail);

    // 炸弹猪引线
    if (type === 'bomb') {
      const fuse = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.3, 8), mat(0x111111, 0));
      fuse.position.set(0, 0.6, 0);
      g.add(fuse);
      const spark = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), new THREE.MeshBasicMaterial({ color: 0xFF6600 }));
      spark.position.set(0, 0.78, 0);
      g.add(spark);
    }

    // 飞速猪刘海
    if (type === 'speed') {
      const tuft = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.15, 6), mat(c.accent));
      tuft.position.set(0, 0.45, 0.1);
      tuft.rotation.x = -0.5;
      g.add(tuft);
    }

    g.userData.type = 'pig';
    g.userData.pigType = type;
    return g;
  },

  createBird(birdType) {
    const g = new THREE.Group();
    // PRD: 飞鸟绿, 站鸟橙
    const bodyColor = birdType === 'flying' ? 0x4CAF50 : 0xFF9800;
    const mat = (color, shininess = 40) => new THREE.MeshPhongMaterial({ color, shininess, specular: 0x333333 });

    const body = new THREE.Mesh(new THREE.SphereGeometry(0.4, 24, 18), mat(bodyColor));
    body.castShadow = true;
    g.add(body);

    // 肚子
    const belly = new THREE.Mesh(new THREE.SphereGeometry(0.28, 16, 12), mat(0xF8F8F8, 20));
    belly.position.set(0, -0.1, 0.1);
    belly.scale.set(1, 0.7, 0.8);
    g.add(belly);

    // 嘴
    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.2, 8), mat(0xFFA500));
    beak.rotation.x = Math.PI / 2;
    beak.position.set(0, -0.05, 0.4);
    g.add(beak);

    // 翅膀
    [(-0.35), 0.35].forEach(dx => {
      const wing = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 8), mat(bodyColor, 20));
      wing.position.set(dx, 0, 0);
      wing.scale.set(0.3, 0.7, 1);
      g.add(wing);
      g.userData.wings = g.userData.wings || [];
      g.userData.wings.push(wing);
    });

    // 眼睛
    [(-0.12), 0.12].forEach(dx => {
      const eyeWhite = new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 8), mat(0xFFFFFF, 60));
      eyeWhite.position.set(dx, 0.12, 0.32);
      g.add(eyeWhite);
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), mat(0x000000, 0));
      pupil.position.set(dx, 0.12, 0.38);
      g.add(pupil);
      g.userData.eyes = g.userData.eyes || [];
      g.userData.eyes.push({ white: eyeWhite, pupil: pupil });
    });

    // 头羽
    [(-0.05), 0.05].forEach(dx => {
      const feather = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.15, 6), mat(bodyColor));
      feather.position.set(dx, 0.35, 0);
      feather.rotation.z = dx * 5;
      g.add(feather);
    });

    // 尾羽
    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.2, 6), mat(bodyColor, 20));
    tail.position.set(0, 0, -0.35);
    tail.rotation.x = -Math.PI / 2;
    g.add(tail);

    g.userData.type = 'bird';
    g.userData.birdType = birdType;
    g.userData.expression = 'normal';
    return g;
  },

  setBirdExpression(birdGroup, expression) {
    if (!birdGroup || !birdGroup.userData.eyes) return;
    birdGroup.userData.expression = expression;
    const eyes = birdGroup.userData.eyes;
    switch (expression) {
      case 'alert':
        eyes.forEach(e => { e.white.scale.set(1.2, 1.2, 1.2); e.pupil.scale.set(1, 1, 1); });
        break;
      case 'panic':
        eyes.forEach(e => { e.white.scale.set(1.5, 1.5, 1.5); e.pupil.scale.set(0.8, 0.8, 0.8); });
        break;
      case 'hit':
        eyes.forEach(e => { e.white.scale.set(1, 1, 1); e.pupil.rotation.z = Math.PI; });
        break;
      default:
        eyes.forEach(e => { e.white.scale.set(1, 1, 1); e.pupil.scale.set(1, 1, 1); e.pupil.rotation.z = 0; });
    }
  },

  createSlingshot() {
    const g = new THREE.Group();
    const woodMat = new THREE.MeshPhongMaterial({ color: 0x8B4513, shininess: 10 });
    const forkMat = new THREE.MeshPhongMaterial({ color: 0xA0522D, shininess: 10 });

    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 1.5, 12), woodMat);
    post.position.y = 0.75;
    post.castShadow = true;
    g.add(post);

    [(-0.15), 0.15].forEach(dx => {
      const fork = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.6, 10), forkMat);
      fork.position.set(dx, 1.45, 0);
      fork.rotation.z = dx > 0 ? -0.4 : 0.4;
      fork.castShadow = true;
      g.add(fork);
    });

    // 橡皮筋
    const bandMat = new THREE.MeshPhongMaterial({ color: 0x444444, shininess: 5 });
    [(-0.15), 0.15].forEach(dx => {
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.5, 6), bandMat);
      band.position.set(dx, 1.55, 0);
      g.add(band);
    });

    g.position.set(2, 0, 0);
    return g;
  },

  createBlock(type, w, h, d) {
    const colors = { ice: 0x88DDFF, wood: 0xC68642, stone: 0x888888 };
    const opacity = { ice: 0.7, wood: 1.0, stone: 1.0 };
    const mat = new THREE.MeshPhongMaterial({
      color: colors[type],
      shininess: type === 'ice' ? 80 : 10,
      transparent: type === 'ice',
      opacity: opacity[type],
      specular: type === 'ice' ? 0xFFFFFF : 0x333333,
    });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  },

  createHill(w, h, d) {
    const geo = new THREE.BoxGeometry(w, h, d);
    const mat = new THREE.MeshPhongMaterial({ color: 0x6B8E23, shininess: 5 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    return mesh;
  },

  createGround() {
    const geo = new THREE.PlaneGeometry(60, 40, 10, 10);
    const mat = new THREE.MeshPhongMaterial({ color: 0x7CB342, shininess: 5 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.receiveShadow = true;
    return mesh;
  },

  createSky() {
    const geo = new THREE.SphereGeometry(50, 32, 16);
    const mat = new THREE.MeshBasicMaterial({ color: 0x87CEEB, side: THREE.BackSide, fog: true });
    return new THREE.Mesh(geo, mat);
  },

  createCloud(x, y, z) {
    const g = new THREE.Group();
    const mat = new THREE.MeshPhongMaterial({ color: 0xFFFFFF, transparent: true, opacity: 0.8 });
    for (let i = 0; i < 4; i++) {
      const s = 0.5 + Math.random() * 0.5;
      const cloud = new THREE.Mesh(new THREE.SphereGeometry(s, 8, 6), mat);
      cloud.position.set(i * 0.6 - 0.9, Math.random() * 0.2, 0);
      g.add(cloud);
    }
    g.position.set(x, y, z);
    return g;
  },

  createMountain(x, z, scale) {
    const geo = new THREE.ConeGeometry(scale, scale * 1.5, 12);
    const mat = new THREE.MeshPhongMaterial({ color: 0x556B2F, shininess: 5 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, scale * 0.75 - 0.5, z);
    return mesh;
  },

  createSun() {
    const sun = new THREE.Mesh(new THREE.SphereGeometry(2, 16, 12), new THREE.MeshBasicMaterial({ color: 0xFFEB3B }));
    sun.position.set(-20, 25, -30);
    return sun;
  },

  createDebris(color, size) {
    return new THREE.Mesh(
      new THREE.BoxGeometry(size || 0.15, size || 0.15, size || 0.15),
      new THREE.MeshPhongMaterial({ color })
    );
  },

  createTrajectoryDot() {
    return new THREE.Mesh(
      new THREE.SphereGeometry(0.06, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xFFFFFF, transparent: true, opacity: 0.6 })
    );
  },
};
