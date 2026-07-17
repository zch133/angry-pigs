// 愤怒的猪 3D - 核心游戏逻辑 v3.0
// 对齐 PRD v2.1/v3.0 全部数值；手感对齐经典弹弓抛射玩法。
// 依赖: THREE (r128), CANNON (0.6.2), CONFIG, Models, Audio, LEVELS, MAPS

const C = CONFIG;

// ========== 全局状态 ==========
const G = {
  scene: null, camera: null, renderer: null, world: null, canvas: null,
  raycaster: null, aimPlane: null,
  state: 'menu',            // menu | playing | paused | result
  phase: 'idle',            // idle|loading|ready|aiming|flying|settling|ending
  currentLevel: 0, score: 0, birdsHit: 0, totalBirds: 0,
  pigQueue: [], currentPigIndex: 0,
  pigMesh: null, pigBody: null,
  abilityUsed: false, speedBoostOn: false,
  birds: [], blocks: [], hills: [], tnts: [],
  debris: [], feathers: [], fxMeshes: [], floatTexts: [],
  isDragging: false, pullVec: null,      // pullVec: THREE.Vector3 拖拽偏移
  trajectoryDots: [], bandL: null, bandR: null,
  camYaw: 1.45, camPitch: 0.5, camDist: 15, camMode: 'sling', // sling|follow|return|manual（yaw≈90° 侧视角对齐原版）
  camTargetPos: null, camLookAt: null, returnTimer: 0,
  trauma: 0, timeScale: 1, slowMoTimer: 0, hitstopTimer: 0,
  comboCount: 0, comboTimer: 0, hitBuildingThisFlight: false,
  pigStopTimer: 0, turnTimer: 0,
  save: null, guideActive: false,
  speedHintShown: false, bombHintShown: false,
  pointer: { down: false, id: -1, x: 0, y: 0, downX: 0, downY: 0, button: 0, orbiting: false, pinch: 0 },
  touches: {},
  audioReady: false,
  theme: null, decor: [],
  blockAABBTimer: 0,
  killedThisTurn: 0,
  pendingChain: [],   // TNT 链爆队列 {x,y,z,t}
  pendingRemove: [],  // 延迟移除物理体 {body,mesh,t}
  result: null,
  dt: 0, time: 0,
};

const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;

// ========== 初始化 ==========
function initGame() {
  G.canvas = document.getElementById('game-canvas');
  G.scene = new THREE.Scene();
  G.scene.background = new THREE.Color(0x87CEEB);
  G.scene.fog = new THREE.Fog(0x87CEEB, 40, 90);

  G.camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 200);
  const isTouch = 'ontouchstart' in window;
  G.renderer = new THREE.WebGLRenderer({ canvas: G.canvas, antialias: !isTouch });
  G.renderer.setSize(innerWidth, innerHeight);
  G.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));

  // 灯光
  G.ambient = new THREE.AmbientLight(0xffffff, 0.62);
  G.scene.add(G.ambient);
  G.sun = new THREE.DirectionalLight(0xffffff, 0.75);
  G.sun.position.set(-12, 22, 10);
  G.scene.add(G.sun);

  // 物理世界
  G.world = new CANNON.World();
  G.world.gravity.set(0, C.GRAVITY, 0);
  G.world.broadphase = new CANNON.NaiveBroadphase();
  G.world.solver.iterations = C.SOLVER_ITERATIONS;
  G.world.allowSleep = true;

  // 物理材质
  G.phyMat = {
    ground: new CANNON.Material('ground'),
    pig: new CANNON.Material('pig'),
    ice: new CANNON.Material('ice'),
    wood: new CANNON.Material('wood'),
    stone: new CANNON.Material('stone'),
    tnt: new CANNON.Material('tnt'),
  };
  const cm = (a, b, f, r) => G.world.addContactMaterial(new CANNON.ContactMaterial(a, b, { friction: f, restitution: r }));
  G.world.defaultContactMaterial.friction = 0.45;
  G.world.defaultContactMaterial.restitution = 0.12;
  cm(G.phyMat.ground, G.phyMat.ice, 0.03, 0.05);  // 冰面滑
  cm(G.phyMat.ice, G.phyMat.ice, 0.02, 0.05);
  cm(G.phyMat.ground, G.phyMat.pig, 0.5, 0.35);
  cm(G.phyMat.pig, G.phyMat.ice, 0.05, 0.2);
  cm(G.phyMat.pig, G.phyMat.wood, 0.4, 0.25);
  cm(G.phyMat.pig, G.phyMat.stone, 0.5, 0.2);

  // 地面
  const groundBody = new CANNON.Body({ mass: 0, material: G.phyMat.ground, shape: new CANNON.Plane() });
  groundBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
  G.world.addBody(groundBody);
  G.groundBody = groundBody;

  G.raycaster = new THREE.Raycaster();
  G.aimPlane = new THREE.Plane();

  // 弹弓
  G.slingshot = Models.createSlingshot();
  G.slingshot.position.set(C.SLINGSHOT_POS.x, C.SLINGSHOT_POS.y, C.SLINGSHOT_POS.z);
  G.scene.add(G.slingshot);
  const bandMat = new THREE.MeshPhongMaterial({ color: 0x3B2110, shininess: 10 });
  G.bandL = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1, 6), bandMat);
  G.bandR = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1, 6), bandMat);
  G.scene.add(G.bandL); G.scene.add(G.bandR);

  // 轨迹点
  const dotGeo = new THREE.SphereGeometry(0.055, 8, 6);
  const dotMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7 });
  for (let i = 0; i < C.TRAJECTORY_DOTS; i++) {
    const d = new THREE.Mesh(dotGeo, dotMat.clone());
    d.visible = false;
    G.scene.add(d);
    G.trajectoryDots.push(d);
  }

  loadSave();
  setupInput();
  setupUI();
  applyMapTheme(MAPS[0]);
  showMenu();
  addEventListener('resize', onResize);
  onResize();
  requestAnimationFrame(animate);
}

function onResize() {
  G.camera.aspect = innerWidth / innerHeight;
  G.camera.updateProjectionMatrix();
  G.renderer.setSize(innerWidth, innerHeight);
  document.getElementById('rotate-hint').classList.toggle('hidden', innerWidth >= innerHeight);
}

// ========== 地图主题 ==========
function applyMapTheme(map) {
  G.theme = map;
  const t = map.theme;
  G.scene.background = new THREE.Color(t.sky);
  G.scene.fog = new THREE.Fog(t.fog != null ? t.fog : t.sky, 40, 95);
  G.ambient.color.set(t.ambient != null ? t.ambient : 0xffffff);
  G.sun.color.set(t.sun != null ? t.sun : 0xffffff);
  G.sun.intensity = t.sunIntensity != null ? t.sunIntensity : 0.75;

  // 清掉旧装饰
  for (const d of G.decor) G.scene.remove(d);
  G.decor = [];

  // 地面
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(240, 160),
    new THREE.MeshPhongMaterial({ color: t.ground, shininess: 5 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = C.GROUND_Y;
  G.scene.add(ground); G.decor.push(ground);

  // 远景装饰：种子确定性摆放
  const rng = mulberry32(hashStr(map.id));
  const decorSet = {
    grassland: () => [Models.createTree(0.9 + rng() * 0.7), Models.createTree(0.7 + rng() * 0.5, 0x5E8C46), Models.createGrassTuft(1 + rng())],
    desert:    () => [Models.createCactus(0.7 + rng() * 0.6), Models.createRock(0.7 + rng() * 0.9, 0xC2A878), Models.createBone(0.8 + rng() * 0.5)],
    snow:      () => [Models.createSnowPine(0.8 + rng() * 0.6), Models.createIceSpike(0.6 + rng() * 0.8)],
    volcano:   () => [Models.createVolcanoRock(0.8 + rng() * 1.2), Models.createRock(0.6 + rng() * 0.7, 0x5D4037)],
    sky:       () => [Models.createCloud(0.8 + rng() * 0.8), Models.createFloatingIsland(1 + rng() * 0.8)],
  }[map.id] || (() => []);

  for (let i = 0; i < 14; i++) {
    const items = decorSet();
    for (const m of items) {
      // 避开主战区 (x: -2..30, z: -4..4)
      let x, z, tries = 0;
      do {
        x = -14 + rng() * 56;
        z = (rng() < 0.5 ? -1 : 1) * (6 + rng() * 16);
        tries++;
      } while (tries < 8 && x > -4 && x < 32 && Math.abs(z) < 5);
      m.position.set(x, map.id === 'sky' ? 2 + rng() * 6 : 0, z);
      m.rotation.y = rng() * Math.PI * 2;
      G.scene.add(m); G.decor.push(m);
    }
  }
  // 远山
  for (let i = 0; i < 5; i++) {
    const mt = Models.createMountain(1.2 + rng() * 1.6, t.mountain != null ? t.mountain : 0x8E9EAB, map.id === 'snow');
    mt.position.set(-18 + i * 13 + rng() * 4, 0, -26 - rng() * 8);
    G.scene.add(mt); G.decor.push(mt);
  }
  // 太阳
  const sun = Models.createSun(t.sunBall != null ? t.sunBall : 0xFFD54F);
  sun.position.set(-18, 16, -30);
  G.scene.add(sun); G.decor.push(sun);
  // 云（近景漂浮）
  G.clouds = [];
  for (let i = 0; i < 4; i++) {
    const cl = Models.createCloud(1 + rng() * 0.8);
    cl.position.set(-10 + rng() * 36, 9 + rng() * 4, -8 - rng() * 10);
    G.scene.add(cl); G.decor.push(cl); G.clouds.push(cl);
  }
  // 火山熔岩池
  if (map.id === 'volcano') {
    const lava = Models.createLavaPool(2.4);
    lava.position.set(24, 0.02, -7);
    G.scene.add(lava); G.decor.push(lava); G.lavaPool = lava;
  } else G.lavaPool = null;
}

// 简单确定性随机
function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// ========== 关卡加载 ==========
function loadLevel(idx) {
  clearLevel();
  const lv = LEVELS[idx];
  const map = MAPS.find(m => m.id === lv.map) || MAPS[0];
  if (G.theme !== map) applyMapTheme(map);

  G.currentLevel = idx;
  frameLevelCamera(lv);
  G.score = 0; G.birdsHit = 0; G.totalBirds = lv.birds.length;
  G.pigQueue = lv.pigTypes.map(t => ({ type: t }));
  G.currentPigIndex = 0;
  G.abilityUsed = false; G.speedBoostOn = false;
  G.comboCount = 0; G.comboTimer = 0;
  G.hitBuildingThisFlight = false;
  G.killedThisTurn = 0;
  G.state = 'playing';
  G.phase = 'loading';
  showLoading(true);

  // 建筑块
  lv.blocks.forEach(bd => spawnBlock(bd));
  // 山坡
  (lv.hills || []).forEach(hd => {
    const r = Math.min(hd.w, hd.h) * 0.95;
    const mesh = Models.createHill(hd.w, hd.h, hd.d, G.theme.id === 'desert' ? 0xD9B36A : (G.theme.id === 'volcano' ? 0x6D4C41 : 0x7CB342));
    mesh.position.set(hd.x, hd.y || 0, hd.z);
    G.scene.add(mesh);
    const body = new CANNON.Body({ mass: 0, shape: new CANNON.Sphere(r), position: new CANNON.Vec3(hd.x, hd.y || 0, hd.z) });
    G.world.addBody(body);
    G.hills.push({ mesh, body });
  });
  // 鸟
  lv.birds.forEach(bd => spawnBird(bd));

  // 物理预演算（同步快速跑，让结构先稳定）
  const steps = Math.round(C.PRE_SIM_SECONDS * 60);
  for (let i = 0; i < steps; i++) G.world.step(C.FIXED_DT);
  for (const b of G.blocks) { b.body.velocity.setZero(); b.body.angularVelocity.setZero(); b.body.sleep(); }

  updateHUD(); updatePigQueueUI();
  loadNextPig();
  // 相机直接落位弹弓视角
  const pose = slingCamPose();
  G.camera.position.copy(pose.pos);
  G.camLookAt = pose.look.clone();
  G.camera.lookAt(G.camLookAt);
  showLoading(false);

  // 第一关新手引导
  if (idx === 0 && !G.save.guideDone) {
    G.guideActive = true;
    document.getElementById('guide-hint').classList.remove('hidden');
  }
  document.getElementById('hud').classList.remove('hidden');
  document.getElementById('pig-queue').classList.remove('hidden');
  hideAllOverlays();
}

function spawnBlock(bd) {
  const mesh = Models.createBlock(bd.type, bd.w, bd.h, bd.d);
  mesh.position.set(bd.x, bd.y, bd.z);
  if (bd.rotY) mesh.rotation.y = bd.rotY;
  G.scene.add(mesh);
  const body = new CANNON.Body({
    mass: C.MAT_DENSITY[bd.type] * bd.w * bd.h * bd.d,
    material: G.phyMat[bd.type === 'tnt' ? 'tnt' : bd.type],
    shape: new CANNON.Box(new CANNON.Vec3(bd.w / 2, bd.h / 2, bd.d / 2)),
    position: new CANNON.Vec3(bd.x, bd.y, bd.z),
  });
  if (bd.rotY) body.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), bd.rotY);
  body.allowSleep = true;
  body.sleepSpeedLimit = 0.3; body.sleepTimeLimit = 0.45;
  const block = { mesh, body, type: bd.type, hp: C.MAT_HP[bd.type], maxHp: C.MAT_HP[bd.type], lastHitAt: 0, dead: false };
  body.userData = { kind: 'block', ref: block };
  body.addEventListener('collide', e => onBlockCollide(block, e));
  G.world.addBody(body);
  G.blocks.push(block);
  if (bd.type === 'tnt') G.tnts.push(block);
}

function spawnBird(bd) {
  const mesh = Models.createBird(bd.type);
  mesh.position.set(bd.x, bd.y, bd.z);
  G.scene.add(mesh);
  const bird = {
    mesh, kind: bd.type, alive: true,
    cx: bd.x, cy: bd.y, cz: bd.z, range: bd.range || 1.2,
    tx: bd.x, ty: bd.y, tz: bd.z,      // 飞鸟目标点
    dir: Math.random() < 0.5 ? 1 : -1, // 站鸟方向
    wingT: Math.random() * 6, retargetT: 0,
    body: null, deadTimer: 0, chirpT: 2 + Math.random() * 6,
  };
  G.birds.push(bird);
}

function clearLevel() {
  for (const b of G.blocks) { G.scene.remove(b.mesh); if (b.body) G.world.removeBody(b.body); }
  for (const b of G.birds) { G.scene.remove(b.mesh); if (b.body) G.world.removeBody(b.body); }
  for (const h of G.hills) { G.scene.remove(h.mesh); G.world.removeBody(h.body); }
  for (const d of G.debris) G.scene.remove(d.mesh);
  for (const f of G.feathers) G.scene.remove(f.mesh);
  for (const f of G.fxMeshes) G.scene.remove(f.mesh);
  for (const t of G.floatTexts) t.el.remove();
  for (const p of G.pendingRemove) { if (p.mesh) G.scene.remove(p.mesh); if (p.body) G.world.removeBody(p.body); }
  if (G.pigMesh) { G.scene.remove(G.pigMesh); G.pigMesh = null; }
  if (G.pigBody) { G.world.removeBody(G.pigBody); G.pigBody = null; }
  G.blocks = []; G.birds = []; G.hills = []; G.tnts = [];
  G.debris = []; G.feathers = []; G.fxMeshes = []; G.floatTexts = [];
  G.pendingChain = []; G.pendingRemove = []; G.bodyRemovals = [];
  clearTrajectory();
  G.pullVec = null; G.isDragging = false;
}

// ========== 装填 ==========
function loadNextPig() {
  if (G.currentPigIndex >= G.pigQueue.length) { endLevel(false); return; }
  const type = G.pigQueue[G.currentPigIndex].type;
  G.pigMesh = Models.createPig(type);
  G.pigMesh.position.set(C.SLINGSHOT_POS.x, C.SLINGSHOT_POS.y, C.SLINGSHOT_POS.z);
  G.scene.add(G.pigMesh);
  G.pigBody = null;
  G.abilityUsed = false; G.speedBoostOn = false;
  G.hitBuildingThisFlight = false;
  G.killedThisTurn = 0;
  G.phase = 'ready';
  G.camMode = 'sling';
  updateHUD(); updatePigQueueUI();
  updateBands();
  // 技能提示
  maybeShowSkillHint(type);
}

// ========== 输入处理 ==========
function setupInput() {
  const el = G.canvas;
  el.style.touchAction = 'none';

  el.addEventListener('pointerdown', e => {
    ensureAudio();
    G.pointer.down = true; G.pointer.id = e.pointerId;
    G.pointer.x = G.pointer.downX = e.clientX; G.pointer.y = G.pointer.downY = e.clientY;
    G.pointer.button = e.button;
    G.pointer.orbiting = false;
    el.setPointerCapture(e.pointerId);

    if (G.state !== 'playing') return;

    // 飞行中点击 = 触发技能
    if (G.phase === 'flying') { triggerAbility(); return; }
    if (G.phase !== 'ready') return;

    // 点到猪附近 → 开始拖拽瞄准
    if (hitPig(e.clientX, e.clientY)) {
      G.phase = 'aiming';
      G.isDragging = true;
      G.pullVec = V3(0, 0, 0);
      Audio.stretchStart();
      if (G.guideActive) { G.guideActive = false; document.getElementById('guide-hint').classList.add('hidden'); G.save.guideDone = true; saveSave(); }
    } else if (cameraManualAllowed()) {
      G.pointer.orbiting = true;
    }
  });

  el.addEventListener('pointermove', e => {
    if (!G.pointer.down || e.pointerId !== G.pointer.id) return;
    const dx = e.clientX - G.pointer.x, dy = e.clientY - G.pointer.y;
    G.pointer.x = e.clientX; G.pointer.y = e.clientY;

    if (G.state !== 'playing') return;

    if (G.phase === 'aiming' && G.isDragging) {
      updatePull(e.clientX, e.clientY);
    } else if (G.pointer.orbiting && cameraManualAllowed()) {
      G.camYaw -= dx * 0.005;
      G.camPitch = clamp(G.camPitch + dy * 0.004, 0.15, 1.25);
    }
  });

  const release = e => {
    if (e.pointerId !== G.pointer.id) return;
    G.pointer.down = false; G.pointer.orbiting = false;
    if (G.state === 'playing' && G.phase === 'aiming' && G.isDragging) {
      G.isDragging = false;
      Audio.stretchStop();
      if (G.pullVec && G.pullVec.length() > 0.35) launchPig();
      else { // 微拖=取消
        G.phase = 'ready'; G.pullVec = null;
        clearTrajectory(); updateBands();
        if (G.pigMesh) G.pigMesh.position.set(C.SLINGSHOT_POS.x, C.SLINGSHOT_POS.y, C.SLINGSHOT_POS.z);
      }
    }
  };
  el.addEventListener('pointerup', release);
  el.addEventListener('pointercancel', release);

  el.addEventListener('wheel', e => {
    if (G.state === 'playing' && cameraManualAllowed()) {
      G.camDist = clamp(G.camDist + e.deltaY * 0.02, 7, 30);
    }
  }, { passive: true });

  // 双指捏合缩放
  el.addEventListener('touchstart', e => { if (e.touches.length === 2) G.pointer.pinch = dist2(e.touches[0], e.touches[1]); }, { passive: true });
  el.addEventListener('touchmove', e => {
    if (e.touches.length === 2 && G.state === 'playing' && cameraManualAllowed()) {
      const d = dist2(e.touches[0], e.touches[1]);
      if (G.pointer.pinch > 0) G.camDist = clamp(G.camDist - (d - G.pointer.pinch) * 0.03, 7, 30);
      G.pointer.pinch = d;
    }
  }, { passive: true });
}
function dist2(a, b) { return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY); }
function ensureAudio() { if (!G.audioReady) { Audio.init(); G.audioReady = true; } }

function hitPig(cx, cy) {
  if (!G.pigMesh) return false;
  G.raycaster.setFromCamera({ x: (cx / innerWidth) * 2 - 1, y: -(cy / innerHeight) * 2 + 1 }, G.camera);
  const hits = G.raycaster.intersectObject(G.pigMesh, true);
  if (hits.length) return true;
  // 屏幕空间容差：猪投影半径 60px 内
  const p = G.pigMesh.position.clone().project(G.camera);
  const sx = (p.x + 1) / 2 * innerWidth, sy = (1 - p.y) / 2 * innerHeight;
  return Math.hypot(cx - sx, cy - sy) < 60;
}

function updatePull(cx, cy) {
  G.raycaster.setFromCamera({ x: (cx / innerWidth) * 2 - 1, y: -(cy / innerHeight) * 2 + 1 }, G.camera);
  // 瞄准平面：过弹弓点，法线=相机朝向
  const n = G.camera.getWorldDirection(V3(0, 0, 0)).negate();
  G.aimPlane.setFromNormalAndCoplanarPoint(n, V3(C.SLINGSHOT_POS.x, C.SLINGSHOT_POS.y, C.SLINGSHOT_POS.z));
  const pt = V3(0, 0, 0);
  if (!G.raycaster.ray.intersectPlane(G.aimPlane, pt)) return;
  const off = pt.sub(V3(C.SLINGSHOT_POS.x, C.SLINGSHOT_POS.y, C.SLINGSHOT_POS.z));
  // 只能往后拉（-x），少量上下左右
  off.x = clamp(off.x, -C.MAX_PULL, 0.4);
  off.y = clamp(off.y, -C.MAX_PULL * 0.85, C.MAX_PULL * 0.7);
  off.z = clamp(off.z, -1.2, 1.2);
  if (off.length() > C.MAX_PULL) off.setLength(C.MAX_PULL);
  G.pullVec = off;
  const power01 = off.length() / C.MAX_PULL;
  Audio.stretchUpdate(power01);
  // 猪跟随拖拽
  G.pigMesh.position.set(C.SLINGSHOT_POS.x + off.x, C.SLINGSHOT_POS.y + off.y, C.SLINGSHOT_POS.z + off.z);
  G.pigMesh.rotation.z = -off.x * 0.4;
  updateBands();
  updateTrajectory();
  updatePowerUI(power01);
}

// ========== 橡皮筋 ==========
function updateBands() {
  const forkL = G.slingshot.userData.forkL.clone().add(G.slingshot.position);
  const forkR = G.slingshot.userData.forkR.clone().add(G.slingshot.position);
  const pigPos = G.pigMesh ? G.pigMesh.position : V3(C.SLINGSHOT_POS.x, C.SLINGSHOT_POS.y, C.SLINGSHOT_POS.z);
  const show = G.pigMesh && (G.phase === 'ready' || G.phase === 'aiming');
  G.bandL.visible = G.bandR.visible = !!show;
  if (!show) return;
  setBand(G.bandL, forkL, pigPos);
  setBand(G.bandR, forkR, pigPos);
}
function setBand(mesh, a, b) {
  const mid = a.clone().add(b).multiplyScalar(0.5);
  const len = a.distanceTo(b);
  mesh.position.copy(mid);
  mesh.scale.set(1, len, 1);
  mesh.quaternion.setFromUnitVectors(V3(0, 1, 0), b.clone().sub(a).normalize());
}

// ========== 轨迹预测 (Issue 3) ==========
function updateTrajectory() {
  if (!G.pullVec) return;
  const v = G.pullVec.clone().multiplyScalar(-C.LAUNCH_POWER);
  const p = V3(C.SLINGSHOT_POS.x, C.SLINGSHOT_POS.y, C.SLINGSHOT_POS.z);
  for (let i = 0; i < G.trajectoryDots.length; i++) {
    const d = G.trajectoryDots[i];
    p.addScaledVector(v, C.TRAJECTORY_DT);
    v.y += C.GRAVITY * C.TRAJECTORY_DT;
    d.position.copy(p);
    d.visible = p.y > 0;
    const s = 1 - i / G.trajectoryDots.length * 0.6;
    d.scale.setScalar(s);
  }
}
function clearTrajectory() { for (const d of G.trajectoryDots) d.visible = false; }

// ========== 发射 ==========
function launchPig() {
  const vel = G.pullVec.clone().multiplyScalar(-C.LAUNCH_POWER);
  clearTrajectory();
  updatePowerUI(0);

  const body = new CANNON.Body({
    mass: 2,
    material: G.phyMat.pig,
    shape: new CANNON.Sphere(C.PIG_RADIUS),
    position: new CANNON.Vec3(C.SLINGSHOT_POS.x, C.SLINGSHOT_POS.y, C.SLINGSHOT_POS.z),
  });
  body.velocity.set(vel.x, vel.y, vel.z);
  body.angularDamping = 0.3;
  body.linearDamping = 0.01;
  body.allowSleep = false;
  body.userData = { kind: 'pig' };
  body.addEventListener('collide', onPigCollide);
  G.world.addBody(body);
  G.pigBody = body;
  G.phase = 'flying';
  G.pigStopTimer = 0;
  G.camMode = 'follow';
  Audio.launch(G.pullVec.length() / C.MAX_PULL);
  Audio.pigOink();
  G.pullVec = null;
  updateBands();
  // 挤压拉伸：发射瞬间
  G.pigMesh.scale.set(1.25, 0.8, 0.9);
  setTimeout(() => { if (G.pigMesh) G.pigMesh.scale.set(1, 1, 1); }, 140);
}

// ========== 技能 (Issue 6) ==========
function triggerAbility() {
  if (!G.pigBody || G.abilityUsed || !G.pigMesh) return;
  const type = G.pigMesh.userData.pigType;
  if (type === 'speed') {
    G.abilityUsed = true; G.speedBoostOn = true;
    const v = G.pigBody.velocity;
    v.scale(C.SPEED_BOOST_MULT, v);
    Audio.boost();
    spawnFloatText(G.pigMesh.position, '冲刺!', '#FFE066', 26);
    hideSkillHint();
  } else if (type === 'bomb') {
    G.abilityUsed = true;
    explodePig();
    hideSkillHint();
  }
}

function explodePig() {
  if (!G.pigMesh || !G.pigBody) return;
  const p = G.pigMesh.position;
  explode(p.x, p.y, p.z);
  // 移除猪
  removePig(true);
  G.phase = 'settling';
  G.turnTimer = 900; // 爆炸后稍等尘埃落定
}

// ========== 碰撞与伤害模型 (Issue 1) ==========
function onPigCollide(e) {
  if (G.phase !== 'flying') return;
  const other = e.body;
  const speed = Math.abs(e.contact.getImpactVelocityAlongNormal());
  if (other.userData && other.userData.kind === 'block') {
    G.hitBuildingThisFlight = true;
    G.speedBoostOn = false;
    if (speed > 1.5) Audio[other.userData.ref.type === 'ice' ? 'iceHit' : other.userData.ref.type === 'wood' ? 'woodHit' : 'stoneHit'](speed);
    if (speed > C.HITSTOP_MIN_SPEED) { G.hitstopTimer = C.HITSTOP_MS; addTrauma(clamp(speed / 22, 0.15, 0.7)); }
  } else if (other === G.groundBody) {
    G.speedBoostOn = false;
    if (speed > 3) { Audio.bump(); spawnDust(G.pigMesh.position, 5); addTrauma(0.12); }
  }
  // 撞山
  for (const h of G.hills) if (e.body === h.body && speed > 3) { Audio.bump(); addTrauma(0.1); }
}

function onBlockCollide(block, e) {
  if (block.dead || !G.armed) return;
  const now = performance.now();
  if (now - block.lastHitAt < C.HIT_COOLDOWN_MS) return;
  const speed = Math.abs(e.contact.getImpactVelocityAlongNormal());
  if (speed < 1.2) return;
  block.lastHitAt = now;

  // 阈值模型：高速一击碎
  if ((block.type === 'ice' && speed > C.SPEED_BREAK_ICE) ||
      (block.type === 'wood' && speed > C.SPEED_BREAK_WOOD)) {
    destroyBlock(block, speed);
    return;
  }
  // 常规 -1HP
  damageBlock(block, 1, speed);
}

function damageBlock(block, dmg, impactSpeed = 3) {
  if (block.dead) return;
  block.hp -= dmg;
  if (block.hp <= 0) { destroyBlock(block, impactSpeed); return; }
  // 裂痕阶段
  const lost = block.maxHp - block.hp;
  const stage = lost / block.maxHp > 0.55 ? 2 : 1;
  Models.addCrack(block.mesh, stage);
  if (block.type === 'wood') Audio.woodHit(impactSpeed);
  else if (block.type === 'stone') Audio.stoneHit(impactSpeed);
  else Audio.iceHit(impactSpeed);
}

function destroyBlock(block, impactSpeed = 5) {
  if (block.dead) return;
  block.dead = true;
  const p = block.mesh.position;
  // 分数
  const sc = C.MAT_SCORE[block.type] || 500;
  addScore(sc, p, '#' + ({ ice: '9ADFFF', wood: 'C68642', stone: 'AAAAAA', tnt: 'FF7043' }[block.type] || 'FFF'));
  // 音效
  if (block.type === 'ice') Audio.iceBreak();
  else if (block.type === 'wood') Audio.woodBreak();
  else if (block.type === 'stone') Audio.stoneBreak();
  // 碎片
  spawnDebris(p, block.type, block.mesh.userData.w, block.mesh.userData.h, block.mesh.userData.d);
  addTrauma(clamp(impactSpeed / 30, 0.08, 0.4));
  if (impactSpeed > C.HITSTOP_MIN_SPEED) G.hitstopTimer = Math.max(G.hitstopTimer, C.HITSTOP_MS);
  // 移除
  G.scene.remove(block.mesh);
  G.world.removeBody(block.body);
  block.body = null;
  // TNT 链爆
  if (block.type === 'tnt') G.pendingChain.push({ x: p.x, y: p.y, z: p.z, t: C.TNT_CHAIN_DELAY_MS });
}

// ========== 爆炸 (PRD 7.3) ==========
function explode(x, y, z) {
  Audio.explode();
  addTrauma(0.85);
  G.hitstopTimer = Math.max(G.hitstopTimer, C.HITSTOP_MS);
  // 视觉
  const fx = Models.createExplosionFX(C.EXPLOSION_RADIUS);
  fx.position.set(x, y, z);
  G.scene.add(fx);
  G.fxMeshes.push({ mesh: fx, t: 0, dur: 450, kind: 'explosion' });
  spawnDebris({ x, y, z }, 'stone', 1, 1, 1, 10);
  spawnFlash(x, y, z);

  const R = C.EXPLOSION_RADIUS;
  // 建筑：固定3伤，线性衰减 中心3→边缘1
  for (const block of [...G.blocks]) {
    if (block.dead) continue;
    const d = block.mesh.position.distanceTo({ x, y, z });
    if (d > R + 0.5) continue;
    const dmg = Math.max(1, Math.round(C.EXPLOSION_DAMAGE_CENTER - (d / R) * (C.EXPLOSION_DAMAGE_CENTER - 1)));
    if (block.body) {
      const dir = block.mesh.position.clone().sub(V3(x, y, z)).normalize();
      block.body.wakeUp();
      block.body.velocity.x += dir.x * C.EXPLOSION_IMPULSE * (1 - d / (R + 1)) * 0.6;
      block.body.velocity.y += (dir.y + 0.6) * C.EXPLOSION_IMPULSE * (1 - d / (R + 1)) * 0.6;
      block.body.velocity.z += dir.z * C.EXPLOSION_IMPULSE * (1 - d / (R + 1)) * 0.6;
    }
    damageBlock(block, dmg, 10);
  }
  // 鸟：直接击落
  for (const bird of G.birds) {
    if (!bird.alive) continue;
    const d = bird.mesh.position.distanceTo({ x, y, z });
    if (d <= R + C.BIRD_RADIUS) killBird(bird, null, true);
  }
}

function spawnFlash(x, y, z) {
  const light = new THREE.PointLight(0xFFAB40, 3, 12);
  light.position.set(x, y + 0.5, z);
  G.scene.add(light);
  G.fxMeshes.push({ mesh: light, t: 0, dur: 260, kind: 'flash' });
}

// ========== 击落鸟 ==========
function killBird(bird, killerVel, byExplosion = false) {
  if (!bird.alive) return;
  bird.alive = false;
  G.birdsHit++;
  G.killedThisTurn++;
  // 连击
  const now = performance.now();
  if (now - G.comboTimer <= C.COMBO_WINDOW_MS) G.comboCount++;
  else G.comboCount = 1;
  G.comboTimer = now;
  const mult = G.comboCount >= 5 ? C.COMBO_MULT[5] : (C.COMBO_MULT[G.comboCount] || 1);
  const base = C.SCORE_BIRD;
  const gained = Math.round(base * mult);
  addScore(gained, bird.mesh.position, '#7CFC00', 30);
  // 精准命中
  if (!G.hitBuildingThisFlight && !byExplosion && killerVel) {
    addScore(C.SCORE_PRECISION, bird.mesh.position.clone().add(V3(0, 0.7, 0)), '#FFD54F', 22);
  }
  if (G.comboCount >= 2) { spawnComboText(mult); Audio.combo(G.comboCount); }
  Audio.birdHit(); Audio.birdDown();
  // 慢动作 + 震屏
  G.slowMoTimer = C.SLOWMO_MS;
  addTrauma(0.5);
  // 羽毛
  spawnFeathers(bird.mesh.position, bird.kind);
  // 变物理体掉落
  const body = new CANNON.Body({
    mass: 0.6,
    shape: new CANNON.Sphere(C.BIRD_RADIUS),
    position: new CANNON.Vec3(bird.mesh.position.x, bird.mesh.position.y, bird.mesh.position.z),
  });
  body.angularDamping = 0.4;
  if (killerVel) body.velocity.set(killerVel.x * 0.55, Math.max(killerVel.y * 0.55, 2.5), killerVel.z * 0.55);
  else body.velocity.set(0, 1.5, 0);
  body.userData = { kind: 'deadbird' };
  G.world.addBody(body);
  bird.body = body;
  bird.deadTimer = 2600;
  // 表情
  bird.mesh.userData.eyes.forEach(e => { e.pupil.scale.setScalar(1.5); });
  updateHUD();
}

// ========== 计分 ==========
function addScore(n, pos, color = '#FFF', size = 24) {
  G.score += n;
  spawnFloatText(pos, '+' + n, color, size);
  updateHUD();
}

// ========== 回合/关卡结算 ==========
function endTurn() {
  if (G.pigBody) removePig(false);
  G.currentPigIndex++;
  G.comboCount = 0;
  // 检查结束
  if (G.birdsHit >= G.totalBirds) { endLevel(true); return; }
  if (G.currentPigIndex >= G.pigQueue.length) { endLevel(false); return; }
  G.phase = 'returning';
  G.returnTimer = C.CAMERA_RETURN_PAUSE_MS;
}

function removePig(exploded) {
  if (G.pigBody) { G.world.removeBody(G.pigBody); G.pigBody = null; }
  if (G.pigMesh) {
    if (!exploded) spawnDust(G.pigMesh.position, 4);
    G.scene.remove(G.pigMesh); G.pigMesh = null;
  }
  updateBands();
}

function endLevel(win) {
  G.phase = 'ending';
  G.state = 'result';
  let stars = 0;
  if (win) {
    // 剩余猪奖励
    const remaining = G.pigQueue.length - G.currentPigIndex;
    if (remaining > 0) {
      const bonus = remaining * C.SCORE_REMAINING_PIG;
      G.score += bonus;
      spawnFloatText(V3(C.SLINGSHOT_POS.x, C.SLINGSHOT_POS.y + 1.5, 0), '剩余猪 +' + bonus, '#FFD54F', 26);
    }
    const lv = LEVELS[G.currentLevel];
    stars = G.score >= lv.threeStar ? 3 : G.score >= lv.twoStar ? 2 : 1;
    Audio.win();
    // 存档
    const id = lv.id;
    G.save.unlocked = Math.max(G.save.unlocked, G.currentLevel + 1);
    G.save.stars[id] = Math.max(G.save.stars[id] || 0, stars);
    G.save.best[id] = Math.max(G.save.best[id] || 0, G.score);
    saveSave();
  } else {
    Audio.lose();
  }
  G.result = { win, stars, score: G.score };
  setTimeout(() => showResult(win, stars, G.score), win ? 1200 : 900);
}

// ========== 主循环 ==========
let _lastT = 0;
function animate(t) {
  requestAnimationFrame(animate);
  const rawDt = Math.min(t - _lastT, 100); _lastT = t;
  G.dt = rawDt;

  // 顿帧
  if (G.hitstopTimer > 0) { G.hitstopTimer -= rawDt; render(); return; }
  // 慢动作
  if (G.slowMoTimer > 0) { G.slowMoTimer -= rawDt; G.timeScale = C.SLOWMO_SCALE; }
  else G.timeScale = 1;
  const dt = rawDt * G.timeScale;
  G.time += dt;

  if (G.state === 'playing' || G.state === 'result') {
    stepGame(dt, rawDt);
  }
  updateAmbient(dt);
  updateCamera(rawDt);
  updateFloatTexts(rawDt);
  render();
}
function render() {
  // 震屏
  if (G.trauma > 0.001) {
    const s = G.trauma * G.trauma * C.SHAKE_MAX;
    G.camera.position.x += (Math.random() - 0.5) * s;
    G.camera.position.y += (Math.random() - 0.5) * s;
    G.camera.rotation.z += (Math.random() - 0.5) * s * 0.02;
  }
  G.renderer.render(G.scene, G.camera);
}
function addTrauma(n) { G.trauma = clamp(G.trauma + n, 0, 1); }

function stepGame(dt, rawDt) {
  // 物理
  G.world.step(C.FIXED_DT, dt / 1000, 3);
  // 延迟移除物理体
  for (const b of G.bodyRemovals) G.world.removeBody(b);
  G.bodyRemovals.length = 0;

  // 同步网格
  for (const b of G.blocks) {
    if (b.dead || !b.body) continue;
    b.mesh.position.copy(b.body.position);
    b.mesh.quaternion.copy(b.body.quaternion);
  }
  for (const b of G.birds) {
    if (b.alive || !b.body) continue;
    b.mesh.position.copy(b.body.position);
    b.mesh.quaternion.copy(b.body.quaternion);
  }

  // 猪飞行同步与停止判定
  if (G.phase === 'flying' && G.pigBody && G.pigMesh) {
    G.pigMesh.position.copy(G.pigBody.position);
    G.pigMesh.rotation.x += G.pigBody.angularVelocity.x * dt / 1000;
    G.pigMesh.rotation.z += G.pigBody.angularVelocity.z * dt / 1000;
    const v = G.pigBody.velocity;
    const speed = v.norm();
    // 滚动阻力：贴地低速时快速停球（cannon 球体滚动摩擦弱，原版手感是落地即停）
    const dtS = dt / 1000;
    if (G.pigMesh.position.y < C.PIG_RADIUS + 0.08 && speed < 5) {
      const damp = Math.max(0, 1 - 4.5 * dtS);
      v.scale(damp, v);
      G.pigBody.angularVelocity.scale(Math.max(0, 1 - 6 * dtS), G.pigBody.angularVelocity);
      if (speed < 0.4) { v.set(0, 0, 0); G.pigBody.angularVelocity.set(0, 0, 0); }
    }
    // 飞速猪拖尾
    if (G.speedBoostOn && Math.random() < 0.5) spawnSpeedTrail(G.pigMesh.position);
    // 出界
    if (G.pigMesh.position.x > C.OUT_X_MAX || G.pigMesh.position.x < C.OUT_X_MIN || G.pigMesh.position.y < C.OUT_Y_MIN) {
      endTurn(); return;
    }
    // 停止判定：速度<0.1 持续0.5秒
    if (speed < C.PIG_STOP_SPEED) {
      G.pigStopTimer += dt;
      if (G.pigStopTimer > C.PIG_STOP_TIME_MS) { endTurn(); return; }
    } else G.pigStopTimer = 0;
    // 猪撞鸟检测（鸟无碰撞体，用距离）
    for (const bird of G.birds) {
      if (!bird.alive) continue;
      if (G.pigMesh.position.distanceTo(bird.mesh.position) < C.PIG_RADIUS + C.BIRD_RADIUS + 0.06) {
        killBird(bird, v);
      }
    }
  }

  // settling 阶段（爆炸后等稳定）
  if (G.phase === 'settling') {
    G.turnTimer -= dt;
    if (G.turnTimer <= 0) { endTurn(); return; }
  }
  // returning 阶段
  if (G.phase === 'returning') {
    G.returnTimer -= dt;
    if (G.returnTimer <= 0) loadNextPig();
  }

  // 块撞鸟检测（移动中的块砸到鸟）
  for (const bird of G.birds) {
    if (!bird.alive) continue;
    for (const b of G.blocks) {
      if (b.dead || !b.body || b.body.sleepState === 2) continue;
      const sp = b.body.velocity.norm();
      if (sp < C.BIRD_KILL_SPEED) continue;
      if (sphereHitsBlock(bird.mesh.position, C.BIRD_RADIUS + 0.08, b)) { killBird(bird, b.body.velocity); break; }
    }
  }

  updateBirds(dt);
  updateChain(dt);
  updatePendingRemove(dt);
  updateParticles(dt);
  G.trauma = Math.max(0, G.trauma - rawDt / 1000 * C.SHAKE_DECAY);
  if (G.comboTimer && performance.now() - G.comboTimer > C.COMBO_WINDOW_MS) G.comboCount = 0;
  G.blockAABBTimer -= dt;
}

// 球与有向盒近似检测（局部坐标）
function sphereHitsBlock(center, r, block) {
  const inv = block.mesh.quaternion.clone().inverse();
  const local = center.clone().sub(block.mesh.position).applyQuaternion(inv);
  const { w, h, d } = block.mesh.userData;
  const cx = clamp(local.x, -w / 2, w / 2), cy = clamp(local.y, -h / 2, h / 2), cz = clamp(local.z, -d / 2, d / 2);
  return (local.x - cx) ** 2 + (local.y - cy) ** 2 + (local.z - cz) ** 2 < r * r;
}

// ========== 鸟 AI ==========
function updateBirds(dt) {
  const dtS = dt / 1000;
  for (const bird of G.birds) {
    const m = bird.mesh;
    if (!bird.alive) {
      bird.deadTimer -= dt;
      if (bird.deadTimer < 600) m.traverse(o => { if (o.material) { o.material.transparent = true; o.material.opacity = Math.max(0, bird.deadTimer / 600); } });
      if (bird.deadTimer <= 0 && bird.body) {
        G.world.removeBody(bird.body); G.scene.remove(m); bird.body = null;
      }
      continue;
    }
    bird.wingT += dtS * (bird.kind === 'flying' ? 10 : 6);
    const flap = Math.sin(bird.wingT) * 0.5;
    m.userData.wings.forEach((w, i) => { w.rotation.z = (i === 0 ? 1 : -1) * flap; });

    if (bird.kind === 'flying') {
      // 飘移：朝目标点，避开建筑AABB
      bird.retargetT -= dt;
      const pos = m.position;
      const toT = Math.hypot(bird.tx - pos.x, bird.ty - pos.y, bird.tz - pos.z);
      if (toT < 0.2 || bird.retargetT <= 0) {
        bird.retargetT = 1500 + Math.random() * 2000;
        // 在圆心范围内选新目标，且不进入建筑缓冲AABB
        for (let tries = 0; tries < 10; tries++) {
          const a = Math.random() * Math.PI * 2, rr = Math.random() * C.FLY_WANDER_RADIUS;
          const tx = bird.cx + Math.cos(a) * rr, ty = bird.cy + Math.sin(a) * rr * 0.6, tz = bird.cz + (Math.random() - 0.5) * 1.2;
          if (!pointInAnyBlockAABB(tx, ty, tz)) { bird.tx = tx; bird.ty = ty; bird.tz = tz; break; }
        }
      }
      const dir = V3(bird.tx - pos.x, bird.ty - pos.y, bird.tz - pos.z);
      if (dir.length() > 0.05) {
        dir.normalize();
        const next = pos.clone().addScaledVector(dir, C.FLY_SPEED * dtS);
        if (!pointInAnyBlockAABB(next.x, next.y, next.z)) pos.copy(next);
        else bird.retargetT = 0; // 被挡立刻换目标
        m.rotation.y = Math.atan2(dir.x, dir.z) * 0.6;
      }
      pos.y += Math.sin(bird.wingT * 0.35) * 0.004; // 上下浮动
    } else {
      // 站鸟：平台上来回跑，碰壁转身（不穿过建筑）
      const pos = m.position;
      const nextX = pos.x + bird.dir * C.GROUND_RUN_SPEED * dtS;
      if (pointInAnyBlockAABB(nextX, pos.y, pos.z, 0.06)) {
        bird.dir *= -1;
      } else {
        pos.x = nextX;
      }
      if (pos.x > bird.cx + bird.range) { pos.x = bird.cx + bird.range; bird.dir = -1; }
      if (pos.x < bird.cx - bird.range) { pos.x = bird.cx - bird.range; bird.dir = 1; }
      pos.y = bird.cy + Math.abs(Math.sin(bird.wingT * 0.8)) * 0.06; // 跑动小跳
      m.rotation.y = bird.dir > 0 ? 0.5 : -0.5;
    }

    // 表情：猪距离
    if (G.pigMesh && (G.phase === 'flying' || G.phase === 'aiming')) {
      const d = m.position.distanceTo(G.pigMesh.position);
      const scale = d < C.BIRD_PANIC_DIST ? 1.6 : d < C.BIRD_ALERT_DIST ? 1.25 : 1;
      m.userData.eyes.forEach(e => e.white.scale.setScalar(scale));
      if (d < C.BIRD_PANIC_DIST && Math.random() < 0.02) Audio.birdChirp();
    }
    // 偶尔叫
    bird.chirpT -= dtS;
    if (bird.chirpT <= 0) { bird.chirpT = 4 + Math.random() * 8; if (Math.random() < 0.6) Audio.birdChirp(); }
  }
}

// 建筑 AABB（含外扩缓冲）碰撞：用当前块位置近似
function pointInAnyBlockAABB(x, y, z, pad) {
  if (pad == null) pad = C.FLY_AVOID_PAD;
  for (const b of G.blocks) {
    if (b.dead) continue;
    const p = b.mesh.position, u = b.mesh.userData;
    if (Math.abs(x - p.x) < u.w / 2 + pad && Math.abs(y - p.y) < u.h / 2 + pad && Math.abs(z - p.z) < u.d / 2 + pad) return true;
  }
  return false;
}

// ========== TNT 链爆 ==========
function updateChain(dt) {
  for (let i = G.pendingChain.length - 1; i >= 0; i--) {
    const c = G.pendingChain[i];
    c.t -= dt;
    if (c.t <= 0) { G.pendingChain.splice(i, 1); explode(c.x, c.y, c.z); }
  }
}
function updatePendingRemove(dt) {
  for (let i = G.pendingRemove.length - 1; i >= 0; i--) {
    const p = G.pendingRemove[i];
    p.t -= dt;
    if (p.t <= 0) { if (p.body) G.world.removeBody(p.body); if (p.mesh) G.scene.remove(p.mesh); G.pendingRemove.splice(i, 1); }
  }
}

// ========== 粒子与特效 ==========
function spawnDebris(p, type, w = 1, h = 1, d = 1, count = 0) {
  const n = count || clamp(Math.round((w * h * d) * 6), 5, 14);
  for (let i = 0; i < n; i++) {
    const mesh = Models.createDebrisPiece(type);
    mesh.position.set(p.x + (Math.random() - 0.5) * w * 0.7, p.y + (Math.random() - 0.5) * h * 0.7, p.z + (Math.random() - 0.5) * d * 0.7);
    G.scene.add(mesh);
    G.debris.push({
      mesh,
      vx: (Math.random() - 0.5) * 5, vy: 2 + Math.random() * 4, vz: (Math.random() - 0.5) * 5,
      vrot: (Math.random() - 0.5) * 0.25, life: 1600 + Math.random() * 800,
    });
  }
}
function spawnFeathers(p, kind) {
  const color = kind === 'flying' ? 0xC8E6C9 : 0xFFE0B2;
  for (let i = 0; i < 8; i++) {
    const mesh = Models.createFeather(color);
    mesh.position.copy(p);
    G.scene.add(mesh);
    G.feathers.push({
      mesh,
      vx: (Math.random() - 0.5) * 2.4, vy: 1 + Math.random() * 1.6, vz: (Math.random() - 0.5) * 2.4,
      life: 1200 + Math.random() * 600, phase: Math.random() * 6,
    });
  }
}
function spawnDust(p, n = 5) {
  for (let i = 0; i < n; i++) {
    const mesh = Models.createFeather(0xD7CCC8);
    mesh.scale.setScalar(1.6);
    mesh.position.set(p.x, Math.max(0.1, p.y - 0.3), p.z);
    G.scene.add(mesh);
    G.feathers.push({ mesh, vx: (Math.random() - 0.5) * 1.6, vy: 0.6 + Math.random(), vz: (Math.random() - 0.5) * 1.6, life: 700, phase: Math.random() * 6 });
  }
}
function spawnSpeedTrail(p) {
  const mesh = Models.createFeather(0xFFF59D);
  mesh.scale.setScalar(1.8);
  mesh.position.copy(p);
  G.scene.add(mesh);
  G.feathers.push({ mesh, vx: 0, vy: 0, vz: 0, life: 260, phase: 0 });
}
function updateParticles(dt) {
  const dtS = dt / 1000;
  for (let i = G.debris.length - 1; i >= 0; i--) {
    const d = G.debris[i];
    d.vy += C.GRAVITY * dtS;
    d.mesh.position.x += d.vx * dtS; d.mesh.position.y += d.vy * dtS; d.mesh.position.z += d.vz * dtS;
    d.mesh.rotation.x += d.vrot; d.mesh.rotation.z += d.vrot * 0.7;
    if (d.mesh.position.y < 0.05) { d.mesh.position.y = 0.05; d.vy *= -0.35; d.vx *= 0.55; d.vz *= 0.55; }
    d.life -= dt;
    if (d.life < 400) d.mesh.scale.multiplyScalar(0.92);
    if (d.life <= 0) { G.scene.remove(d.mesh); G.debris.splice(i, 1); }
  }
  for (let i = G.feathers.length - 1; i >= 0; i--) {
    const f = G.feathers[i];
    f.phase += dtS * 6;
    f.vy += C.GRAVITY * 0.12 * dtS; // 轻飘
    f.mesh.position.x += (f.vx + Math.sin(f.phase) * 0.4) * dtS;
    f.mesh.position.y += f.vy * dtS;
    f.mesh.position.z += f.vz * dtS;
    f.mesh.rotation.y += dtS * 3;
    f.life -= dt;
    if (f.mesh.material) f.mesh.material.opacity = clamp(f.life / 500, 0, 1);
    if (f.life <= 0 || f.mesh.position.y < 0) { G.scene.remove(f.mesh); G.feathers.splice(i, 1); }
  }
  for (let i = G.fxMeshes.length - 1; i >= 0; i--) {
    const fx = G.fxMeshes[i];
    fx.t += dt;
    const k = fx.t / fx.dur;
    if (fx.kind === 'explosion') {
      fx.mesh.scale.setScalar(lerp(0.3, fx.mesh.userData.maxScale, k));
      fx.mesh.material.opacity = 0.85 * (1 - k);
    } else if (fx.kind === 'flash') {
      fx.mesh.intensity = 3 * (1 - k);
    }
    if (fx.t >= fx.dur) { G.scene.remove(fx.mesh); G.fxMeshes.splice(i, 1); }
  }
}

// ========== 相机 (Issue 4) ==========
function cameraManualAllowed() {
  return G.state === 'playing' && (G.phase === 'ready' || G.phase === 'returning') && !G.cameraLocked;
}
function slingCamPose() {
  const yaw = G.camYaw, pitch = G.camPitch, dist = G.camDist;
  const look = V3(G.levelLookX != null ? G.levelLookX : C.SLINGSHOT_POS.x + 6.5, 2.2, 0);
  const pos = V3(
    look.x - Math.cos(pitch) * Math.cos(yaw) * dist,
    look.y + Math.sin(pitch) * dist,
    look.z + Math.cos(pitch) * Math.sin(yaw) * dist
  );
  return { pos, look };
}

// 按关卡内容范围自动取景
function frameLevelCamera(lv) {
  let maxX = 12;
  for (const b of lv.blocks) maxX = Math.max(maxX, b.x + b.w / 2);
  for (const b of lv.birds) maxX = Math.max(maxX, b.x + 1);
  const span = maxX - C.SLINGSHOT_POS.x;
  G.levelLookX = C.SLINGSHOT_POS.x + span * 0.45;
  G.camDist = clamp(span * 0.62 + 5, 13, 24);
}
function updateCamera(rawDt) {
  if (!G.camera) return;
  const dtS = rawDt / 1000;
  if (G.camMode === 'follow' && G.pigMesh) {
    const p = G.pigMesh.position;
    const v = G.pigBody ? G.pigBody.velocity : { x: 0, y: 0, z: 0 };
    const lead = V3(v.x * 0.22, 0, v.z * 0.22);
    const targetPos = V3(
      clamp(p.x + lead.x, -1, 36),
      Math.max(p.y + 3.0, 3.2),
      clamp(p.z + 9.5, 5, 15)
    );
    G.camera.position.lerp(targetPos, clamp(C.CAMERA_FOLLOW_LERP * dtS, 0, 1));
    G.camLookAt = G.camLookAt || V3(p.x, p.y, p.z);
    G.camLookAt.lerp(V3(p.x + lead.x, p.y, p.z), clamp(6 * dtS, 0, 1));
    G.camera.lookAt(G.camLookAt);
  } else if (G.camMode === 'return') {
    G.returnT = clamp((G.returnT || 0) + dtS / (C.CAMERA_RETURN_MS / 1000), 0, 1);
    const e = 1 - Math.pow(1 - G.returnT, 3); // easeOutCubic
    const pose = slingCamPose();
    G.camera.position.lerpVectors(G.returnFromPos, pose.pos, e);
    G.camLookAt.lerpVectors(G.returnFromLook, pose.look, e);
    G.camera.lookAt(G.camLookAt);
    if (G.returnT >= 1) G.camMode = 'sling';
  } else {
    const pose = slingCamPose();
    G.camera.position.lerp(pose.pos, clamp(8 * dtS, 0, 1));
    G.camLookAt = G.camLookAt || pose.look.clone();
    G.camLookAt.lerp(pose.look, clamp(8 * dtS, 0, 1));
    G.camera.lookAt(G.camLookAt);
  }
}

// ========== 飘字 ==========
function spawnFloatText(pos, text, color = '#FFF', size = 24) {
  const el = document.createElement('div');
  el.className = 'float-text';
  el.textContent = text;
  el.style.color = color;
  el.style.fontSize = size + 'px';
  document.getElementById('game-container').appendChild(el);
  G.floatTexts.push({ el, pos: pos.clone ? pos.clone() : V3(pos.x, pos.y, pos.z), t: 0, dur: 1200 });
}
function spawnComboText(mult) {
  const el = document.getElementById('combo-text');
  el.textContent = '连击 x' + mult + '!';
  el.classList.remove('combo-pop');
  void el.offsetWidth;
  el.classList.add('combo-pop');
}
function updateFloatTexts(rawDt) {
  for (let i = G.floatTexts.length - 1; i >= 0; i--) {
    const f = G.floatTexts[i];
    f.t += rawDt;
    const k = f.t / f.dur;
    const p = f.pos.clone(); p.y += k * 1.2;
    p.project(G.camera);
    f.el.style.left = ((p.x + 1) / 2 * innerWidth) + 'px';
    f.el.style.top = ((1 - p.y) / 2 * innerHeight) + 'px';
    f.el.style.opacity = 1 - k * k;
    if (f.t >= f.dur) { f.el.remove(); G.floatTexts.splice(i, 1); }
  }
}

// ========== 环境动画 ==========
function updateAmbient(dt) {
  const dtS = dt / 1000;
  for (const c of G.clouds || []) {
    c.position.x += dtS * 0.25;
    if (c.position.x > 42) c.position.x = -20;
  }
  if (G.lavaPool) {
    const s = 1 + Math.sin(G.time * 0.004) * 0.06;
    G.lavaPool.scale.set(s, s, 1);
  }
  // 弹弓上猪的待机动画
  if (G.pigMesh && G.phase === 'ready') {
    G.pigMesh.position.y = C.SLINGSHOT_POS.y + Math.sin(G.time * 0.0035) * 0.04;
    G.pigMesh.rotation.z = Math.sin(G.time * 0.002) * 0.05;
    updateBands();
  }
  // 炸弹猪引线火花闪
  if (G.pigMesh && G.pigMesh.userData.spark) {
    G.pigMesh.userData.spark.visible = Math.sin(G.time * 0.03) > -0.4;
  }
}

// ========== UI ==========
function $(id) { return document.getElementById(id); }
function hideAllOverlays() {
  ['menu-screen', 'level-select-screen', 'pause-screen', 'result-screen'].forEach(id => $(id).classList.add('hidden'));
}
function showMenu() {
  G.state = 'menu';
  hideAllOverlays();
  $('menu-screen').classList.remove('hidden');
  $('hud').classList.add('hidden');
  $('pig-queue').classList.add('hidden');
}
function showLoading(on) { $('loading-hint').classList.toggle('hidden', !on); }

function setupUI() {
  $('btn-start').onclick = () => { Audio.click(); startLevel(clamp(G.save.unlocked, 0, LEVELS.length - 1)); };
  $('btn-levels').onclick = () => { Audio.click(); openLevelSelect(); };
  $('btn-back-menu').onclick = () => { Audio.click(); showMenu(); };
  $('pause-btn').onclick = () => { if (G.state === 'playing') { Audio.click(); pauseGame(true); } };
  $('btn-resume').onclick = () => { Audio.click(); pauseGame(false); };
  $('btn-restart').onclick = () => { Audio.click(); $('pause-screen').classList.add('hidden'); startLevel(G.currentLevel); };
  $('btn-pause-menu').onclick = () => { Audio.click(); pauseGame(false); showMenu(); };
  $('btn-next').onclick = () => {
    Audio.click();
    if (G.currentLevel + 1 < LEVELS.length) startLevel(G.currentLevel + 1);
    else showMenu();
  };
  $('btn-retry').onclick = () => { Audio.click(); startLevel(G.currentLevel); };
  $('btn-menu').onclick = () => { Audio.click(); showMenu(); };
  $('volume-slider').oninput = e => Audio.setVolume(e.target.value / 100);
  const camBtn = $('camera-toggle');
  G.cameraLocked = true;
  camBtn.onclick = () => {
    G.cameraLocked = !G.cameraLocked;
    camBtn.textContent = G.cameraLocked ? '🔒' : '🔓';
    camBtn.classList.toggle('locked', G.cameraLocked);
    Audio.click();
  };
  // 地图 Tab（动态生成，5 张地图）
  const tabs = $('map-tabs');
  tabs.innerHTML = '';
  MAPS.forEach(m => {
    const b = document.createElement('button');
    b.className = 'map-tab';
    b.dataset.map = m.id;
    b.textContent = `${m.icon} ${m.name}`;
    b.onclick = () => {
      Audio.click();
      document.querySelectorAll('.map-tab').forEach(t => t.classList.remove('active'));
      b.classList.add('active');
      renderLevelGrid(m.id);
    };
    tabs.appendChild(b);
  });
}

function startLevel(idx) {
  hideAllOverlays();
  loadLevel(idx);
}

function pauseGame(on) {
  if (on) { G.state = 'paused'; $('pause-screen').classList.remove('hidden'); }
  else { G.state = 'playing'; $('pause-screen').classList.add('hidden'); }
}

function openLevelSelect() {
  hideAllOverlays();
  $('level-select-screen').classList.remove('hidden');
  // 选中第一个有关卡进度的地图
  const lv = LEVELS[clamp(G.save.unlocked, 0, LEVELS.length - 1)];
  const mapId = lv ? lv.map : MAPS[0].id;
  document.querySelectorAll('.map-tab').forEach(t => t.classList.toggle('active', t.dataset.map === mapId));
  renderLevelGrid(mapId);
}

function renderLevelGrid(mapId) {
  const grid = $('level-grid');
  grid.innerHTML = '';
  LEVELS.forEach((lv, idx) => {
    if (lv.map !== mapId) return;
    const btn = document.createElement('button');
    btn.className = 'level-btn';
    const unlocked = idx <= G.save.unlocked;
    const stars = G.save.stars[lv.id] || 0;
    btn.disabled = !unlocked;
    btn.innerHTML = `<span class="lv-num">${lv.id}</span><span class="lv-stars">${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}</span>`;
    if (unlocked) btn.onclick = () => { Audio.click(); startLevel(idx); };
    grid.appendChild(btn);
  });
}

function updateHUD() {
  $('level-num').textContent = LEVELS[G.currentLevel] ? LEVELS[G.currentLevel].id : '-';
  $('score').textContent = G.score;
  $('pigs-left').textContent = Math.max(0, G.pigQueue.length - G.currentPigIndex);
  const cur = G.pigQueue[G.currentPigIndex];
  $('pig-type').textContent = cur ? PIG_TYPE_INFO[cur.type].name : '-';
}
function updatePigQueueUI() {
  const q = $('pig-queue');
  q.innerHTML = '';
  G.pigQueue.forEach((p, i) => {
    const s = document.createElement('span');
    s.className = 'pq-item' + (i === G.currentPigIndex ? ' current' : i < G.currentPigIndex ? ' used' : '');
    s.textContent = PIG_TYPE_INFO[p.type].emoji;
    q.appendChild(s);
  });
}
function updatePowerUI(power01) {
  $('power-fill').style.width = (power01 * 100) + '%';
  $('power-indicator').style.opacity = power01 > 0 ? 1 : 0;
}

function maybeShowSkillHint(type) {
  if (type === 'speed' && !G.save.speedHintDone) {
    $('skill-hint').textContent = '💨 飞行中点击屏幕 → 加速冲刺！';
    $('skill-hint').classList.add('show');
    setTimeout(hideSkillHint, 5200);
    G.save.speedHintDone = true; saveSave();
  } else if (type === 'bomb' && !G.save.bombHintDone) {
    $('skill-hint').textContent = '💣 飞行中点击屏幕 → 立刻爆炸！';
    $('skill-hint').classList.add('show');
    setTimeout(hideSkillHint, 5200);
    G.save.bombHintDone = true; saveSave();
  }
}
function hideSkillHint() { $('skill-hint').classList.remove('show'); }

function showResult(win, stars, score) {
  hideAllOverlays();
  $('hud').classList.add('hidden');
  $('pig-queue').classList.add('hidden');
  const last = G.currentLevel >= LEVELS.length - 1;
  $('result-title').textContent = win ? (last ? '🏆 恭喜！全部关卡通关！' : '🎉 关卡完成！') : '😢 挑战失败，再试一次！';
  $('result-stars').innerHTML = win ? [1, 2, 3].map(i => `<span class="star ${i <= stars ? 'on' : ''}" data-i="${i}">★</span>`).join('') : '';
  $('result-score').textContent = '得分: ' + score;
  $('btn-next').classList.toggle('hidden', !win || last);
  $('result-screen').classList.remove('hidden');
  if (win) {
    document.querySelectorAll('#result-stars .star.on').forEach((el, i) => {
      setTimeout(() => { el.classList.add('pop'); Audio.star(i); }, 400 + i * 350);
    });
  }
}

// ========== 存档 ==========
function loadSave() {
  try {
    G.save = JSON.parse(localStorage.getItem(C.SAVE_KEY)) || null;
  } catch (e) { G.save = null; }
  if (!G.save) G.save = { unlocked: 0, stars: {}, best: {}, guideDone: false, speedHintDone: false, bombHintDone: false };
}
function saveSave() {
  try { localStorage.setItem(C.SAVE_KEY, JSON.stringify(G.save)); } catch (e) {}
}

// ========== 猪类型信息 ==========
const PIG_TYPE_INFO = {
  normal: { name: '普通猪', emoji: '🐷' },
  speed: { name: '飞速猪', emoji: '💨' },
  bomb: { name: '炸弹猪', emoji: '💣' },
};

// ========== 启动 ==========
window.addEventListener('load', () => {
  initGame();
  // 调试钩子（仅供自动化测试，正常游玩不影响）
  if (/[?&]debug=1/.test(location.search)) {
    window.__game = {
      G,
      start: i => startLevel(i),
      shoot: (dx, dy, dz) => { // 直接以 pullVec 发射
        if (G.phase !== 'ready') return false;
        G.pullVec = V3(dx, dy, dz);
        G.phase = 'aiming'; G.isDragging = false;
        launchPig();
        return true;
      },
      state: () => ({ state: G.state, phase: G.phase, score: G.score, birdsHit: G.birdsHit, totalBirds: G.totalBirds, pigIndex: G.currentPigIndex, pigs: G.pigQueue.length }),
      ability: () => triggerAbility(),
      aim: (dx, dy, dz) => { // 摆拍瞄准状态（测试用）
        if (G.phase !== 'ready') return false;
        G.phase = 'aiming';
        G.pullVec = V3(dx, dy, dz);
        G.pigMesh.position.set(C.SLINGSHOT_POS.x + dx, C.SLINGSHOT_POS.y + dy, C.SLINGSHOT_POS.z + dz);
        updateBands(); updateTrajectory(); updatePowerUI(G.pullVec.length() / C.MAX_PULL);
        return true;
      },
      ff: sec => { // 快进（测试用，脱离 rAF 节流）
        const n = Math.round(sec * 60);
        for (let i = 0; i < n; i++) { if (G.state === 'playing' || G.state === 'result') stepGame(1000 / 60, 1000 / 60); }
        return window.__game.state();
      },
    };
  }
});
