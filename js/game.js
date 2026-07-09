// 愤怒的猪 3D - 核心游戏逻辑 (PRD v2.1)
// 严格对齐 PRD 全部数值，Issue 1-9 全量实现

// ========== 常量 (PRD 1.6 单位定义) ==========
const PIG_RADIUS = 0.5;
const BIRD_RADIUS = 0.4;
const SLINGSHOT_POS = { x: 2, y: 1.5, z: 0 };
const MAX_PULL = 2.5;
const LAUNCH_POWER = 16;
const GROUND_Y = 0;
const GRAVITY = -9.82;

// PRD 7.1: 材料属性 (Issue 1)
const MAT_HP = { ice: 1, wood: 3, stone: 6 };
const MAT_DENSITY = { ice: 0.5, wood: 1.0, stone: 2.5 };
const MAT_COLOR = { ice: 0x88DDFF, wood: 0xC68642, stone: 0x888888 };
const MAT_SCORE = { ice: 500, wood: 1000, stone: 2000 };
const SPEED_BREAK_ICE = 5;   // PRD: 速度>5碎冰
const SPEED_BREAK_WOOD = 8;  // PRD: 速度>8碎木

// PRD 8.1: 分数 (Issue 2)
const SCORE_BIRD = 5000;
const SCORE_PRECISION = 3000;
const SCORE_REMAINING_PIG = 10000;

// PRD 8.2: 连击 (Issue 2)
const COMBO_WINDOW = 800;
const COMBO_MULT = { 2: 1.5, 3: 2.0, 4: 3.0, 5: 5.0 };

// PRD 7.3: 爆炸 (Issue 10)
const EXPLOSION_RADIUS = 2.5;
const EXPLOSION_DAMAGE_CENTER = 3;

const PIG_TYPES = {
  normal: { name: '普通猪', emoji: '🐷' },
  speed:  { name: '飞速猪', emoji: '💨' },
  bomb:   { name: '炸弹猪', emoji: '💣' },
};

// ========== 游戏状态 ==========
const G = {
  scene: null, camera: null, renderer: null, world: null, canvas: null,
  raycaster: null, plane: null,
  state: 'menu', currentLevel: 0, score: 0, birdsHit: 0, totalBirds: 0,
  pigQueue: [], currentPigIndex: 0,
  pigMesh: null, pigBody: null, pigLaunched: false,
  abilityUsed: false,
  birds: [], blocks: [], hills: [], flyingPigs: [],
  clouds: [], trajectoryDots: [],
  isDragging: false, pullDir: { x: 0, z: 0 }, pullDist: 0,
  cameraMode: 'slingshot', cameraTarget: null, cameraLocked: true,
  cameraFollowTarget: null, cameraReturnTimer: 0,
  comboCount: 0, comboTimer: 0,
  hitBuildingThisFlight: false,
  paused: false, preSimulating: false,
  slowMo: 1, slowMoTimer: 0,
  shakeAmount: 0,
  guideFinger: null, guideShown: false,
  speedUsedBefore: false, bombUsedBefore: false,
  floatTexts: [],
  pigStopTimer: 0,
};

// ========== 初始化 ==========
function initGame() {
  G.canvas = document.getElementById('game-canvas');
  G.scene = new THREE.Scene();
  G.scene.fog = new THREE.Fog(0x87CEEB, 30, 60);

  G.camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 100);
  G.renderer = new THREE.WebGLRenderer({ canvas: G.canvas, antialias: false });
  G.renderer.setSize(window.innerWidth, window.innerHeight);
  G.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  G.renderer.shadowMap.enabled = false; // 移动端关闭阴影提升性能

  // 灯光
  const ambient = new THREE.AmbientLight(0xffffff, 0.6);
  G.scene.add(ambient);
  const sun = new THREE.DirectionalLight(0xffffff, 0.8);
  sun.position.set(-10, 20, 10);
  G.scene.add(sun);

  // 天空 + 地面 + 装饰
  G.scene.add(Models.createSky());
  G.scene.add(Models.createGround());
  G.scene.add(Models.createSun());
  G.scene.add(Models.createMountain(-15, -15, 6));
  G.scene.add(Models.createMountain(-8, -18, 4));
  G.scene.add(Models.createMountain(5, -20, 5));
  G.scene.add(Models.createMountain(15, -18, 4.5));
  for (const [x, y, z] of [[-8,10,-5],[3,12,-10],[12,9,-8],[-3,11,-15]]) {
    const c = Models.createCloud(x, y, z);
    G.clouds.push(c); G.scene.add(c);
  }

  // 弹弓
  G.scene.add(Models.createSlingshot());

  // 物理世界
  G.world = new CANNON.World();
  G.world.gravity.set(0, GRAVITY, 0);
  G.world.broadphase = new CANNON.NaiveBroadphase();
  G.world.solver.iterations = 10;

  // 地面物理体
  const groundBody = new CANNON.Body({ mass: 0, shape: new CANNON.Plane() });
  groundBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
  G.world.addBody(groundBody);

  // 射线投射平面 (PRD 1.5: 拖拽映射到弹弓水平面)
  G.raycaster = new THREE.Raycaster();
  G.plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -SLINGSHOT_POS.y);

  setupInput();
  setupUI();
  animate(0);
}

// ========== 关卡加载 ==========
function loadLevel(idx) {
  clearLevel();
  const lv = LEVELS[idx];
  G.currentLevel = idx;
  G.score = 0;
  G.birdsHit = 0;
  G.totalBirds = lv.birds.length;
  G.pigQueue = lv.pigTypes.map(t => ({ type: t }));
  G.currentPigIndex = 0;
  G.pigLaunched = false;
  G.abilityUsed = false;
  G.flyingPigs = [];
  G.state = 'playing';
  G.comboCount = 0;
  G.comboTimer = 0;

  // PRD: 鸟
  lv.birds.forEach(bd => {
    const mesh = Models.createBird(bd.type);
    mesh.position.set(bd.x, bd.y, bd.z);
    G.scene.add(mesh);
    const bird = {
      mesh, type: bd.type,
      homeX: bd.x, homeY: bd.y, homeZ: bd.z,
      range: bd.range || 1.5,
      t: Math.random() * Math.PI * 2,
      dir: 1, alive: true, falling: false, body: null,
      runRange: bd.type === 'grounded' ? (bd.range || 1.2) : 0, // PRD: range 就是活动范围
      platformWidth: bd.range * 2 || 2.4,
    };
    G.birds.push(bird);
  });

  // PRD: 建筑物
  lv.blocks.forEach(bk => {
    const mesh = Models.createBlock(bk.type, bk.w, bk.h, bk.d);
    mesh.position.set(bk.x, bk.y, bk.z);
    G.scene.add(mesh);
    const body = new CANNON.Body({
      mass: MAT_DENSITY[bk.type],
      shape: new CANNON.Box(new CANNON.Vec3(bk.w / 2, bk.h / 2, bk.d / 2)),
      position: new CANNON.Vec3(bk.x, bk.y, bk.z),
    });
    body.linearDamping = 0.3;
    body.angularDamping = 0.3;
    G.world.addBody(body);
    G.blocks.push({ mesh, body, type: bk.type, hp: MAT_HP[bk.type], alive: true, w: bk.w, h: bk.h, d: bk.d });
  });

  // PRD 14: 山坡 (静态物理碰撞体)
  (lv.hills || []).forEach(hl => {
    const mesh = Models.createHill(hl.w, hl.h, hl.d);
    mesh.position.set(hl.x, hl.y + hl.h / 2, hl.z);
    G.scene.add(mesh);
    const body = new CANNON.Body({
      mass: 0,
      shape: new CANNON.Box(new CANNON.Vec3(hl.w / 2, hl.h / 2, hl.d / 2)),
      position: new CANNON.Vec3(hl.x, hl.y + hl.h / 2, hl.z),
    });
    G.world.addBody(body);
    G.hills.push({ mesh, body });
  });

  // PRD 7.2: 物理预演算 (Issue 4) — 同步循环让建筑settle，不占渲染帧
  G.preSimulating = true;
  document.getElementById('loading-hint').classList.remove('hidden');
  for (let i = 0; i < 60; i++) {
    G.world.step(1 / 60);
  }
  G.blocks.forEach(b => { b.mesh.position.copy(b.body.position); b.mesh.quaternion.copy(b.body.quaternion); });
  G.preSimulating = false;
  document.getElementById('loading-hint').classList.add('hidden');
  loadNextPig();
}

function clearLevel() {
  G.birds.forEach(b => { if (b.mesh.parent) G.scene.remove(b.mesh); if (b.body) G.world.removeBody(b.body); });
  G.blocks.forEach(b => { if (b.mesh.parent) G.scene.remove(b.mesh); if (b.body) G.world.removeBody(b.body); });
  G.hills.forEach(h => { if (h.mesh.parent) G.scene.remove(h.mesh); if (h.body) G.world.removeBody(h.body); });
  G.flyingPigs.forEach(p => { if (p.mesh.parent) G.scene.remove(p.mesh); if (p.body) G.world.removeBody(p.body); });
  if (G.pigMesh && G.pigMesh.parent) G.scene.remove(G.pigMesh);
  if (G.pigBody) G.world.removeBody(G.pigBody);
  G.floatTexts.forEach(t => { if (t.parent) G.scene.remove(t); });
  G.trajectoryDots.forEach(d => { if (d.parent) G.scene.remove(d); });
  G.birds = []; G.blocks = []; G.hills = []; G.flyingPigs = [];
  G.floatTexts = []; G.trajectoryDots = [];
  G.pigMesh = null; G.pigBody = null;
}

function loadNextPig() {
  if (G.currentPigIndex >= G.pigQueue.length) { checkGameOver(); return; }
  const pd = G.pigQueue[G.currentPigIndex];
  G.pigMesh = Models.createPig(pd.type);
  G.pigMesh.position.set(SLINGSHOT_POS.x, SLINGSHOT_POS.y, SLINGSHOT_POS.z);
  G.scene.add(G.pigMesh);
  G.pigLaunched = false;
  G.abilityUsed = false;
  G.hitBuildingThisFlight = false;
  G.comboCount = 0;
  G.comboTimer = 0;
  G.cameraMode = 'slingshot';
  G.cameraTarget = { x: 6, y: 1, z: 0 };
  G.cameraLocked = true;
  updateCameraLockButton();
  updatePigQueue();
  updateHUD();

  // PRD 13.3: 新手引导 (第一关第一次)
  if (G.currentLevel === 0 && G.currentPigIndex === 0 && !G.guideShown) {
    showGuide();
    G.guideShown = true;
  }

  // PRD 9.2: 技能提示
  if (pd.type === 'speed' && !G.speedUsedBefore) showSkillHint('飞速猪：飞行中点击屏幕加速冲刺！');
  if (pd.type === 'bomb' && !G.bombUsedBefore) showSkillHint('炸弹猪：飞行中点击屏幕爆炸！');
}

// ========== 输入处理 ==========
function setupInput() {
  const canvas = G.canvas;
  const getPt = e => {
    if (e.touches?.length) return { x: e.touches[0].clientX, y: e.touches[0].clientY };
    if (e.changedTouches?.length) return { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
    return { x: e.clientX, y: e.clientY };
  };

  const onDown = e => {
    if (G.state !== 'playing' || G.paused || G.preSimulating) return;
    if (G.pigLaunched) {
      // 飞行中点击 → 触发技能
      if (!G.abilityUsed && G.pigBody) {
        const pigData = G.pigQueue[G.currentPigIndex];
        if (pigData.type === 'speed') {
          const v = G.pigBody.velocity;
          const sp = Math.sqrt(v.x*v.x + v.y*v.y + v.z*v.z);
          if (sp > 0.1) G.pigBody.velocity.set(v.x * 2.5, v.y * 2.5, v.z * 2.5);
          G.abilityUsed = true; G.speedUsedBefore = true;
          Audio.boost();
          showAbilityHint('💨 加速！');
        } else if (pigData.type === 'bomb') {
          const p = G.pigBody.position;
          explode(p.x, p.y, p.z);
          G.abilityUsed = true; G.bombUsedBefore = true;
        }
      }
      return;
    }
    // 装填阶段 → 开始拖拽
    const pt = getPt(e);
    const ndcX = (pt.x / window.innerWidth) * 2 - 1;
    const ndcY = -(pt.y / window.innerHeight) * 2 + 1;
    G.raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), G.camera);
    const point = new THREE.Vector3();
    G.raycaster.ray.intersectPlane(G.plane, point);
    if (point) {
      const dx = point.x - SLINGSHOT_POS.x;
      const dz = point.z - SLINGSHOT_POS.z;
      if (Math.sqrt(dx*dx + dz*dz) < 2.0) {
        G.isDragging = true;
        G.cameraLocked = true; // PRD 5.4: 瞄准时锁定相机
        updateCameraLockButton();
        e.preventDefault();
      }
    }
  };

  const onMove = e => {
    if (!G.isDragging) return;
    e.preventDefault();
    const pt = getPt(e);
    const ndcX = (pt.x / window.innerWidth) * 2 - 1;
    const ndcY = -(pt.y / window.innerHeight) * 2 + 1;
    G.raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), G.camera);
    const point = new THREE.Vector3();
    G.raycaster.ray.intersectPlane(G.plane, point);
    if (!point) return;

    const dx = point.x - SLINGSHOT_POS.x;
    const dz = point.z - SLINGSHOT_POS.z;
    const dist = Math.sqrt(dx*dx + dz*dz);
    if (dist > MAX_PULL) {
      const s = MAX_PULL / dist;
      G.pullDir = { x: dx * s, z: dz * s };
      G.pullDist = MAX_PULL;
    } else {
      G.pullDir = { x: dx, z: dz };
      G.pullDist = dist;
    }
    G.pigMesh.position.x = SLINGSHOT_POS.x - G.pullDir.x;
    G.pigMesh.position.z = SLINGSHOT_POS.z - G.pullDir.z;
    G.pigMesh.position.y = SLINGSHOT_POS.y;
    document.getElementById('power-fill').style.width = (Math.min(G.pullDist / MAX_PULL, 1) * 100) + '%';
    if (Math.random() < 0.15) Audio.stretch(G.pullDist / MAX_PULL);
    updateTrajectory();
  };

  const onUp = e => {
    if (!G.isDragging) return;
    G.isDragging = false;
    document.getElementById('power-indicator').style.display = 'none';
    clearTrajectory();
    if (G.pullDist < 0.3) {
      G.pigMesh.position.set(SLINGSHOT_POS.x, SLINGSHOT_POS.y, SLINGSHOT_POS.z);
      G.pullDist = 0;
      return;
    }
    launchPig();
  };

  canvas.addEventListener('mousedown', onDown);
  canvas.addEventListener('mousemove', onMove);
  canvas.addEventListener('mouseup', onUp);
  canvas.addEventListener('touchstart', onDown, { passive: false });
  canvas.addEventListener('touchmove', onMove, { passive: false });
  canvas.addEventListener('touchend', onUp);

  // PRD 5.4: 相机手动操作 (仅装填/等待阶段, 右键拖拽)
  let camDrag = false, camLastX = 0, camLastY = 0, camAngle = 0;
  const canCam = () => !G.cameraLocked && G.state === 'playing' && !G.paused && !G.pigLaunched && !G.isDragging && !G.preSimulating;

  canvas.addEventListener('contextmenu', e => e.preventDefault());
  canvas.addEventListener('mousedown', e => {
    if (e.button === 2 && canCam()) { camDrag = true; camLastX = e.clientX; camLastY = e.clientY; e.preventDefault(); }
  });
  canvas.addEventListener('mousemove', e => {
    if (!camDrag || !canCam()) return;
    camAngle += (e.clientX - camLastX) * 0.01;
    camLastX = e.clientX; camLastY = e.clientY;
    updateCameraPosition(camAngle);
  });
  canvas.addEventListener('mouseup', e => { if (e.button === 2) camDrag = false; });
  canvas.addEventListener('wheel', e => {
    if (!canCam()) return;
    const dist = G.camera.position.length();
    const newDist = Math.max(8, Math.min(30, dist + e.deltaY * 0.02));
    G.camera.position.normalize().multiplyScalar(newDist);
  });

  window.addEventListener('resize', () => {
    G.camera.aspect = window.innerWidth / window.innerHeight;
    G.camera.updateProjectionMatrix();
    G.renderer.setSize(window.innerWidth, window.innerHeight);
  });
}

// ========== 轨迹预测 (Issue 3) ==========
function updateTrajectory() {
  clearTrajectory();
  const power = (G.pullDist / MAX_PULL) * LAUNCH_POWER;
  const vx = -G.pullDir.x * LAUNCH_POWER;
  const vy = power * 0.8;
  const vz = -G.pullDir.z * LAUNCH_POWER;
  let px = G.pigMesh.position.x, py = G.pigMesh.position.y, pz = G.pigMesh.position.z;
  let pvx = vx, pvy = vy, pvz = vz;
  const dt = 1 / 30;
  for (let i = 0; i < 15; i++) {
    pvy += GRAVITY * dt;
    px += pvx * dt; py += pvy * dt; pz += pvz * dt;
    if (py < 0) break;
    const dot = Models.createTrajectoryDot();
    dot.position.set(px, py, pz);
    G.scene.add(dot);
    G.trajectoryDots.push(dot);
  }
}
function clearTrajectory() {
  G.trajectoryDots.forEach(d => { if (d.parent) G.scene.remove(d); });
  G.trajectoryDots = [];
}

// ========== 发射 ==========
function launchPig() {
  const pd = G.pigQueue[G.currentPigIndex];
  const body = new CANNON.Body({
    mass: 1.5,
    shape: new CANNON.Sphere(PIG_RADIUS),
    position: new CANNON.Vec3(G.pigMesh.position.x, G.pigMesh.position.y, G.pigMesh.position.z),
  });
  body.linearDamping = 0.1;
  const power = (G.pullDist / MAX_PULL) * LAUNCH_POWER;
  body.velocity.set(-G.pullDir.x * LAUNCH_POWER, power * 0.8, -G.pullDir.z * LAUNCH_POWER);
  G.world.addBody(body);
  G.pigBody = body;
  G.pigLaunched = true;
  G.hitBuildingThisFlight = false;
  G.comboCount = 0;
  G.comboTimer = 0;
  G.cameraMode = 'follow';
  G.cameraFollowTarget = body;
  G.flyingPigs.push({
    mesh: G.pigMesh, body, type: pd.type,
    stopped: false, stopTime: 0,
    prevPos: { x: body.position.x, y: body.position.y, z: body.position.z },
    stuckFadeTimer: 0,
  });
  Audio.launch();
  G.pullDist = 0;

  // PRD 9.2: 技能提示
  if (pd.type === 'speed' || pd.type === 'bomb') {
    const ah = document.getElementById('ability-hint');
    ah.textContent = pd.type === 'speed' ? '点击屏幕加速！' : '点击屏幕爆炸！';
    ah.style.display = 'block';
    setTimeout(() => { ah.style.display = 'none'; }, 3000);
  }
  hideGuide();
}

// ========== 碰撞检测 ==========
function setupCollisions() {
  setTimeout(() => {
    if (G.world) G.world.addEventListener('postStep', checkCollisions);
  }, 200);
}

function checkCollisions() {
  if (G.state !== 'playing' || G.paused || G.preSimulating) return;

  // 物理体碰撞 (猪 vs 建筑物)
  const contacts = G.world.contacts;
  for (let i = 0; i < contacts.length; i++) {
    const c = contacts[i];
    if (!c.bi || !c.bj) continue;
    const pig = G.flyingPigs.find(p => p.body === c.bi || p.body === c.bj);
    if (!pig || pig.stopped) continue;
    const other = pig.body === c.bi ? c.bj : c.bi;

    const block = G.blocks.find(b => b.body === other && b.alive);
    if (block) {
      const speed = Math.sqrt(pig.body.velocity.x**2 + pig.body.velocity.y**2 + pig.body.velocity.z**2);
      G.hitBuildingThisFlight = true;
      damageBlock(block, speed, pig);
    }
  }

  // 连续碰撞检测: 猪 vs 鸟 (线段-球体相交, 防高速漏帧)
  const hitR = PIG_RADIUS + BIRD_RADIUS + 0.3; // 碰撞半径+缓冲提升手感
  G.flyingPigs.forEach(pig => {
    if (!pig.body || pig.stopped) return;
    const pp = pig.body.position;
    const prev = pig.prevPos;
    pig.prevPos = { x: pp.x, y: pp.y, z: pp.z };

    G.birds.forEach(bird => {
      if (!bird.alive || bird.falling) return;
      const bp = bird.mesh.position;
      const dx = pp.x - prev.x, dy = pp.y - prev.y, dz = pp.z - prev.z;
      const fx = prev.x - bp.x, fy = prev.y - bp.y, fz = prev.z - bp.z;
      const a = dx*dx + dy*dy + dz*dz;
      const b = 2 * (fx*dx + fy*dy + fz*dz);
      const c = fx*fx + fy*fy + fz*fz - hitR * hitR;
      const disc = b*b - 4*a*c;
      if (disc < 0 || a < 0.0001) return;
      const t = (-b - Math.sqrt(disc)) / (2 * a);
      if (t >= 0 && t <= 1) hitBird(bird);
    });
  });
}

// PRD 7.1: 材料伤害 (Issue 1)
function damageBlock(block, speed, pig) {
  if (!block.alive) return;
  // 速度阈值判定
  if (block.type === 'ice' && speed > SPEED_BREAK_ICE) {
    destroyBlock(block);
  } else if (block.type === 'wood' && speed > SPEED_BREAK_WOOD) {
    destroyBlock(block);
  } else {
    block.hp -= 1;
    if (block.hp <= 0) {
      destroyBlock(block);
    } else {
      if (block.type === 'ice') Audio.iceBreak();
      else if (block.type === 'wood') Audio.woodHit();
      else Audio.stoneHit();
    }
  }
}

function destroyBlock(block) {
  block.alive = false;
  G.score += MAT_SCORE[block.type];
  spawnFloatText(block.mesh.position.x, block.mesh.position.y, block.mesh.position.z, '+' + MAT_SCORE[block.type], 0xFFFFFF);
  // 碎片
  for (let i = 0; i < 6; i++) {
    const d = Models.createDebris(MAT_COLOR[block.type], 0.1 + Math.random() * 0.08);
    d.position.copy(block.mesh.position);
    d.position.x += (Math.random() - 0.5) * 0.5;
    d.position.y += (Math.random() - 0.5) * 0.5;
    d.position.z += (Math.random() - 0.5) * 0.5;
    G.scene.add(d);
    setTimeout(() => { if (d.parent) G.scene.remove(d); }, 1000);
  }
  if (block.mesh.parent) G.scene.remove(block.mesh);
  if (block.body) G.world.removeBody(block.body);
  if (block.type === 'ice') Audio.iceBreak();
  else if (block.type === 'wood') Audio.woodHit();
  else Audio.stoneHit();
  updateHUD();
}

// PRD 7.3: 爆炸 (Issue 10)
function explode(x, y, z) {
  Audio.explode();
  G.shakeAmount = 15;
  G.slowMo = 0.2;
  G.slowMoTimer = 300;

  // 视觉
  const explosion = new THREE.Mesh(
    new THREE.SphereGeometry(EXPLOSION_RADIUS, 16, 12),
    new THREE.MeshBasicMaterial({ color: 0xFF6600, transparent: true, opacity: 0.6 })
  );
  explosion.position.set(x, y, z);
  G.scene.add(explosion);
  let scale = 0.1;
  const grow = setInterval(() => {
    scale += 0.15;
    explosion.scale.set(scale, scale, scale);
    explosion.material.opacity -= 0.08;
    if (scale >= 1) { clearInterval(grow); if (explosion.parent) G.scene.remove(explosion); }
  }, 30);

  // 范围伤害: 固定3点, 线性衰减中心3→边缘1
  G.blocks.forEach(block => {
    if (!block.alive) return;
    const dx = block.body.position.x - x;
    const dy = block.body.position.y - y;
    const dz = block.body.position.z - z;
    const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
    if (dist > EXPLOSION_RADIUS) return;
    const damage = EXPLOSION_DAMAGE_CENTER * (1 - dist / EXPLOSION_RADIUS * 0.67); // 中心3→边缘~1
    block.hp -= Math.ceil(damage);
    // 物理推力
    const force = new CANNON.Vec3(dx / dist * 5, 3, dz / dist * 5);
    block.body.applyImpulse(force, block.body.position);
    if (block.hp <= 0) destroyBlock(block);
  });

  // 鸟: 范围内直接击落
  G.birds.forEach(bird => {
    if (!bird.alive || bird.falling) return;
    const bp = bird.mesh.position;
    const dist = Math.sqrt((bp.x-x)**2 + (bp.y-y)**2 + (bp.z-z)**2);
    if (dist < EXPLOSION_RADIUS) hitBird(bird);
  });

  // 移除炸弹猪
  if (G.pigBody) {
    const fp = G.flyingPigs.find(p => p.body === G.pigBody);
    if (fp) fp.stopped = true;
  }
}

// PRD 8.2: 击中鸟 (Issue 2 连击)
function hitBird(bird) {
  bird.alive = false;
  bird.falling = true;
  Models.setBirdExpression(bird.mesh, 'hit');

  // 给鸟物理体让它掉落
  const body = new CANNON.Body({
    mass: 0.5,
    shape: new CANNON.Sphere(BIRD_RADIUS),
    position: new CANNON.Vec3(bird.mesh.position.x, bird.mesh.position.y, bird.mesh.position.z),
  });
  body.linearDamping = 0.2;
  G.world.addBody(body);
  bird.body = body;

  G.birdsHit++;

  // 连击: 只算鸟
  G.comboCount++;
  G.comboTimer = COMBO_WINDOW;
  const mult = COMBO_MULT[G.comboCount] || 1.0;

  let score = SCORE_BIRD;
  if (!G.hitBuildingThisFlight) score += SCORE_PRECISION; // 精准命中
  score = Math.floor(score * mult);
  G.score += score;

  spawnFloatText(bird.mesh.position.x, bird.mesh.position.y + 0.5, bird.mesh.position.z, '+' + score, 0xFFD700);
  if (G.comboCount >= 2) {
    spawnComboText(mult);
    Audio.combo(G.comboCount);
  }

  G.shakeAmount = 5;
  G.slowMo = 0.3;
  G.slowMoTimer = 200;
  Audio.birdHit();
  updateHUD();
  checkGameOver(); // 爆炸杀鸟后也要检查胜负
}

// PRD 6.5: 胜负判定
function checkGameOver() {
  const remaining = G.birds.filter(b => b.alive).length;
  if (remaining === 0) {
    G.state = 'win';
    const remainingPigs = G.pigQueue.length - G.currentPigIndex - 1;
    G.score += remainingPigs * SCORE_REMAINING_PIG;
    updateHUD();
    setTimeout(() => showResult(true), 1000);
  } else if (G.currentPigIndex >= G.pigQueue.length) {
    G.state = 'lose';
    setTimeout(() => showResult(false), 1000);
  }
}

// ========== 鸟更新 ==========
function updateBirds(dt) {
  G.birds.forEach(b => {
    if (!b.alive) {
      if (b.falling && b.body) {
        b.mesh.position.copy(b.body.position);
        b.mesh.quaternion.copy(b.body.quaternion);
        if (b.body.position.y < -1) {
          if (b.body) { G.world.removeBody(b.body); b.body = null; }
          b.falling = false;
        }
      }
      return;
    }

    if (b.type === 'flying') {
      b.t += dt * 0.001;
      const r = b.range * (0.5 + 0.5 * Math.sin(b.t * 0.7));
      const nx = b.homeX + Math.cos(b.t) * r;
      const nz = b.homeZ + Math.sin(b.t) * r;
      const ny = b.homeY + Math.sin(b.t * 1.3) * 0.3;
      // PRD Issue 12: 飞鸟边界 = 圆心半径 + 建筑AABB外扩0.3
      let blocked = false;
      for (const blk of G.blocks) {
        if (!blk.alive) continue;
        const bp = blk.body.position;
        const bw = blk.w / 2 + 0.3, bh = blk.h / 2 + 0.3, bd = blk.d / 2 + 0.3;
        if (Math.abs(bp.x - nx) < bw && Math.abs(bp.y - ny) < bh && Math.abs(bp.z - nz) < bd) {
          blocked = true; break;
        }
      }
      if (!blocked) { b.mesh.position.set(nx, ny, nz); b.mesh.lookAt(nx + Math.cos(b.t), ny, nz + Math.sin(b.t)); }
    } else if (b.type === 'grounded') {
      b.t += dt * 0.002 * b.dir;
      const offset = Math.sin(b.t) * b.runRange;
      b.mesh.position.x = b.homeX + offset;
      b.mesh.position.y = b.homeY + Math.abs(Math.sin(b.t * 2)) * 0.1;
      b.mesh.rotation.y = b.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      if (Math.abs(offset) >= b.runRange * 0.95) b.dir *= -1;
    }

    // PRD 6.4: 鸟表情
    if (G.pigBody && G.pigLaunched) {
      const pp = G.pigBody.position;
      const bp = b.mesh.position;
      const d = Math.sqrt((pp.x-bp.x)**2 + (pp.y-bp.y)**2 + (pp.z-bp.z)**2);
      if (d < 1.0) Models.setBirdExpression(b.mesh, 'panic');
      else if (d < 3.0) Models.setBirdExpression(b.mesh, 'alert');
      else Models.setBirdExpression(b.mesh, 'normal');
    } else {
      Models.setBirdExpression(b.mesh, 'normal');
    }
  });
}

// ========== 猪停止判定 (Issue 9) ==========
function updateFlyingPigs(dt) {
  G.flyingPigs.forEach(pig => {
    if (pig.stopped) return;
    if (!pig.body) return;
    const p = pig.body.position;
    const v = pig.body.velocity;
    const speed = Math.sqrt(v.x*v.x + v.y*v.y + v.z*v.z);

    // 同步mesh
    if (pig.mesh) {
      pig.mesh.position.copy(p);
      pig.mesh.rotation.x += dt * 0.005 * speed;
      pig.mesh.rotation.z += dt * 0.003 * speed;
    }

    // PRD: 速度<0.1持续0.5秒 = 停止
    if (speed < 0.1) {
      pig.stopTime += dt;
      if (pig.stopTime > 500) {
        pig.stopped = true;
        endTurn();
      }
    } else {
      pig.stopTime = 0;
    }

    // PRD: 飞出边界
    if (p.x > 50 || p.x < -20 || p.z > 30 || p.z < -30) {
      pig.stopped = true;
      endTurn();
    }

    // PRD Issue 9: 卡建筑处理
    if (speed < 0.3 && p.y < 3) {
      pig.stuckFadeTimer = (pig.stuckFadeTimer || 0) + dt;
      if (pig.stuckFadeTimer > 1000) {
        pig.stopped = true;
        // 淡出动画
        if (pig.mesh) {
          let opacity = 1;
          const fade = setInterval(() => {
            opacity -= 0.1;
            pig.mesh.traverse(child => {
              if (child.material) { child.material.transparent = true; child.material.opacity = opacity; }
            });
            if (opacity <= 0) {
              clearInterval(fade);
              if (pig.mesh.parent) G.scene.remove(pig.mesh);
              setTimeout(() => { if (pig.body) G.world.removeBody(pig.body); }, 500); // 物理体延迟移除
            }
          }, 50);
        }
        endTurn();
      }
    } else {
      pig.stuckFadeTimer = 0;
    }
  });
}

function endTurn() {
  G.currentPigIndex++;
  G.cameraMode = 'returning';
  G.cameraReturnTimer = 1000;
  G.cameraTarget = { x: 6, y: 1, z: 0 };
  setTimeout(() => {
    if (G.state === 'playing') {
      checkGameOver();
      if (G.state === 'playing') loadNextPig();
    }
  }, 1500);
}

// ========== 相机 (Issue 4) ==========
function updateCameraPosition(angle = 0) {
  const target = G.cameraTarget || { x: 6, y: 1, z: 0 };
  const dist = G.camera.position.length() || 18;
  const height = 10;
  const r = dist * 0.8;
  G.camera.position.set(
    target.x + r * Math.cos(angle),
    height,
    target.z + r * Math.sin(angle) + dist * 0.5
  );
  G.camera.lookAt(target.x, target.y, target.z);
}

function updateCamera(dt) {
  if (G.cameraMode === 'follow' && G.cameraFollowTarget) {
    const p = G.cameraFollowTarget.position;
    G.cameraTarget = { x: p.x, y: p.y, z: p.z };
    const targetPos = new THREE.Vector3(p.x + 8, p.y + 5, p.z + 8);
    G.camera.position.lerp(targetPos, 0.08);
    G.camera.lookAt(p.x, p.y, p.z);
  } else if (G.cameraMode === 'returning') {
    G.cameraReturnTimer -= dt;
    const targetPos = new THREE.Vector3(14, 10, 13);
    G.camera.position.lerp(targetPos, 0.05);
    G.camera.lookAt(6, 1, 0);
    if (G.cameraReturnTimer <= 0) {
      G.cameraMode = 'slingshot';
      G.cameraLocked = true;
      updateCameraLockButton();
    }
  } else {
    const targetPos = new THREE.Vector3(14, 10, 13);
    G.camera.position.lerp(targetPos, 0.05);
    G.camera.lookAt(6, 1, 0);
  }
}

// ========== 飘字 (Issue 7) ==========
function spawnFloatText(x, y, z, text, color) {
  const canvas = document.createElement('canvas');
  canvas.width = 256; canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.font = 'bold 36px Arial';
  ctx.fillStyle = '#' + color.toString(16).padStart(6, '0');
  ctx.textAlign = 'center';
  ctx.fillText(text, 128, 42);
  const tex = new THREE.CanvasTexture(canvas);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
  sprite.position.set(x, y, z);
  sprite.scale.set(2, 0.5, 1);
  G.scene.add(sprite);
  G.floatTexts.push({ sprite, life: 1000, vy: 0.02 });
}

function spawnComboText(mult) {
  const el = document.getElementById('combo-text');
  if (!el) return;
  el.textContent = 'x' + mult;
  el.style.display = 'block';
  el.style.animation = 'none';
  void el.offsetWidth;
  el.style.animation = 'comboPop 0.8s ease-out forwards';
  setTimeout(() => { el.style.display = 'none'; }, 800);
}

function updateFloatTexts(dt) {
  G.floatTexts = G.floatTexts.filter(t => {
    t.life -= dt;
    t.sprite.position.y += t.vy;
    t.sprite.material.opacity = Math.max(0, t.life / 1000);
    if (t.life <= 0) { if (t.sprite.parent) G.scene.remove(t.sprite); return false; }
    return true;
  });
}

// ========== 引导 ==========
function showGuide() {
  const el = document.getElementById('guide-hint');
  if (el) el.style.display = 'flex';
}
function hideGuide() {
  const el = document.getElementById('guide-hint');
  if (el) el.style.display = 'none';
}
function showSkillHint(text) {
  const el = document.getElementById('skill-hint');
  if (!el) return;
  el.textContent = text;
  el.style.display = 'block';
  setTimeout(() => { el.style.display = 'none'; }, 4000);
}
function showAbilityHint(text) {
  const el = document.getElementById('ability-hint');
  if (!el) return;
  el.textContent = text;
  el.style.display = 'block';
  setTimeout(() => { el.style.display = 'none'; }, 2000);
}

// ========== UI ==========
function setupUI() {
  document.getElementById('btn-start').addEventListener('click', () => {
    Audio.click();
    const save = getSave();
    loadLevel(Math.min(save.unlocked - 1, LEVELS.length - 1));
    document.getElementById('menu-screen').classList.add('hidden');
    document.getElementById('hud').classList.remove('hidden');
    document.getElementById('pig-queue').classList.remove('hidden');
    document.getElementById('pause-btn').classList.remove('hidden');
    document.getElementById('camera-toggle').classList.remove('hidden');
  });

  document.getElementById('btn-levels').addEventListener('click', () => {
    Audio.click();
    showLevelSelect();
  });

  document.getElementById('btn-back-menu').addEventListener('click', () => {
    Audio.click();
    document.getElementById('level-select-screen').classList.add('hidden');
    document.getElementById('menu-screen').classList.remove('hidden');
  });

  document.getElementById('btn-next').addEventListener('click', () => {
    Audio.click();
    document.getElementById('result-screen').classList.add('hidden');
    if (G.currentLevel + 1 < LEVELS.length) loadLevel(G.currentLevel + 1);
    else backToMenu();
  });

  document.getElementById('btn-retry').addEventListener('click', () => {
    Audio.click();
    document.getElementById('result-screen').classList.add('hidden');
    loadLevel(G.currentLevel);
  });

  document.getElementById('btn-menu').addEventListener('click', () => {
    Audio.click();
    document.getElementById('result-screen').classList.add('hidden');
    backToMenu();
  });

  document.getElementById('pause-btn').addEventListener('click', () => {
    Audio.click();
    G.paused = true;
    document.getElementById('pause-screen').classList.remove('hidden');
  });

  document.getElementById('btn-resume').addEventListener('click', () => {
    Audio.click();
    G.paused = false;
    document.getElementById('pause-screen').classList.add('hidden');
  });

  document.getElementById('btn-restart').addEventListener('click', () => {
    Audio.click();
    G.paused = false;
    document.getElementById('pause-screen').classList.add('hidden');
    loadLevel(G.currentLevel);
  });

  document.getElementById('btn-pause-menu').addEventListener('click', () => {
    Audio.click();
    G.paused = false;
    document.getElementById('pause-screen').classList.add('hidden');
    backToMenu();
  });

  document.getElementById('camera-toggle').addEventListener('click', () => {
    if (!G.pigLaunched && !G.isDragging && G.state === 'playing') {
      G.cameraLocked = !G.cameraLocked;
      updateCameraLockButton();
      Audio.click();
    }
  });

  const volSlider = document.getElementById('volume-slider');
  if (volSlider) {
    volSlider.addEventListener('input', e => {
      Audio.setVolume(parseFloat(e.target.value) / 100);
    });
  }

  // 竖屏检测
  const checkOrientation = () => {
    const hint = document.getElementById('rotate-hint');
    if (window.innerHeight > window.innerWidth && G.state === 'playing') {
      hint.classList.remove('hidden');
    } else {
      hint.classList.add('hidden');
    }
  };
  window.addEventListener('resize', checkOrientation);
  checkOrientation();
}

function updateCameraLockButton() {
  const btn = document.getElementById('camera-toggle');
  if (!btn) return;
  btn.textContent = G.cameraLocked ? '🔒' : '🔓';
  btn.classList.toggle('locked', G.cameraLocked);
}

function updateHUD() {
  document.getElementById('score').textContent = G.score;
  document.getElementById('pigs-left').textContent = G.pigQueue.length - G.currentPigIndex;
  document.getElementById('level-num').textContent = G.currentLevel + 1;
  if (G.currentPigIndex < G.pigQueue.length) {
    const pt = PIG_TYPES[G.pigQueue[G.currentPigIndex].type];
    document.getElementById('pig-type').textContent = pt.name;
  }
}

function updatePigQueue() {
  const q = document.getElementById('pig-queue');
  q.innerHTML = '';
  G.pigQueue.forEach((pd, i) => {
    const icon = document.createElement('div');
    icon.className = 'pig-queue-icon';
    if (i === G.currentPigIndex) icon.classList.add('current');
    if (i < G.currentPigIndex) icon.style.opacity = '0.25';
    icon.textContent = PIG_TYPES[pd.type].emoji;
    q.appendChild(icon);
  });
}

function showLevelSelect() {
  document.getElementById('menu-screen').classList.add('hidden');
  document.getElementById('level-select-screen').classList.remove('hidden');
  const grid = document.getElementById('level-grid');
  grid.innerHTML = '';
  const save = getSave();
  LEVELS.forEach((lv, i) => {
    const btn = document.createElement('div');
    btn.className = 'level-card';
    const unlocked = i < save.unlocked;
    if (!unlocked) btn.classList.add('locked');
    btn.innerHTML = `<div class="level-num">${i + 1}</div><div class="level-stars">${'⭐'.repeat(save.stars[i] || 0)}${'☆'.repeat(3 - (save.stars[i] || 0))}</div>`;
    if (unlocked) {
      btn.addEventListener('click', () => {
        Audio.click();
        document.getElementById('level-select-screen').classList.add('hidden');
        loadLevel(i);
        document.getElementById('hud').classList.remove('hidden');
        document.getElementById('pig-queue').classList.remove('hidden');
      });
    }
    grid.appendChild(btn);
  });
}

function showResult(win) {
  const screen = document.getElementById('result-screen');
  const title = document.getElementById('result-title');
  const stars = document.getElementById('result-stars');
  const scoreEl = document.getElementById('result-score');
  const btnNext = document.getElementById('btn-next');

  if (win) {
    Audio.win();
    title.textContent = '🎉 通关！';
    const lv = LEVELS[G.currentLevel];
    let starCount = 1;
    if (G.score >= lv.twoStar) starCount = 2;
    if (G.score >= lv.threeStar) starCount = 3;
    stars.innerHTML = '⭐'.repeat(starCount) + '☆'.repeat(3 - starCount);
    scoreEl.textContent = '分数: ' + G.score;
    saveProgress(G.currentLevel, G.score, starCount);
    btnNext.style.display = G.currentLevel + 1 < LEVELS.length ? 'block' : 'none';
  } else {
    Audio.lose();
    title.textContent = '😢 再试一次！';
    stars.textContent = '☆☆☆';
    scoreEl.textContent = '分数: ' + G.score;
    btnNext.style.display = 'none';
  }
  screen.classList.remove('hidden');
}

function backToMenu() {
  G.state = 'menu';
  clearLevel();
  document.getElementById('hud').classList.add('hidden');
  document.getElementById('pig-queue').classList.add('hidden');
  document.getElementById('pause-btn').classList.add('hidden');
  document.getElementById('camera-toggle').classList.add('hidden');
  document.getElementById('menu-screen').classList.remove('hidden');
}

// ========== 存档 ==========
function getSave() {
  try {
    const d = localStorage.getItem('angryPigs3D');
    if (d) return JSON.parse(d);
  } catch (e) {}
  return { unlocked: 1, scores: {}, stars: {} };
}

function saveProgress(idx, score, stars) {
  const save = getSave();
  if (idx + 2 > save.unlocked) save.unlocked = Math.min(idx + 2, LEVELS.length);
  const key = String(idx);
  if (!save.scores[key] || score > save.scores[key]) save.scores[key] = score;
  if (!save.stars[key] || stars > save.stars[key]) save.stars[key] = stars;
  try { localStorage.setItem('angryPigs3D', JSON.stringify(save)); } catch (e) {}
}

// ========== 主循环 ==========
let lastTime = 0;
function animate(time) {
  requestAnimationFrame(animate);
  const dt = Math.min(time - lastTime, 50);
  lastTime = time;

  if (G.state !== 'playing' || G.paused || G.preSimulating) {
    G.renderer.render(G.scene, G.camera);
    return;
  }

  // 物理
  G.world.step(1 / 60 * G.slowMo);

  // 碰撞
  checkCollisions();

  // 更新
  updateBirds(dt);
  updateFlyingPigs(dt);
  updateFloatTexts(dt);

  // 连击计时
  if (G.comboTimer > 0) {
    G.comboTimer -= dt;
    if (G.comboTimer <= 0) G.comboCount = 0;
  }

  // 相机
  updateCamera(dt);

  // 云移动
  G.clouds.forEach(c => { c.position.x += 0.002 * dt; if (c.position.x > 20) c.position.x = -20; });

  // 慢动作恢复
  if (G.slowMoTimer > 0) {
    G.slowMoTimer -= dt;
    if (G.slowMoTimer <= 0) G.slowMo = 1;
  }

  // 震动
  if (G.shakeAmount > 0.1) {
    G.camera.position.x += (Math.random() - 0.5) * G.shakeAmount * 0.05;
    G.camera.position.y += (Math.random() - 0.5) * G.shakeAmount * 0.05;
    G.shakeAmount *= 0.85;
  }

  // 建筑物同步
  G.blocks.forEach(b => {
    if (b.alive && b.body) {
      b.mesh.position.copy(b.body.position);
      b.mesh.quaternion.copy(b.body.quaternion);
    }
  });

  // 待机猪轻微浮动
  if (G.pigMesh && !G.pigLaunched) {
    G.pigMesh.rotation.y = Math.sin(time * 0.002) * 0.15;
    G.pigMesh.position.y = SLINGSHOT_POS.y + Math.sin(time * 0.003) * 0.03;
  }

  G.renderer.render(G.scene, G.camera);
}

// ========== 启动 ==========
window.addEventListener('load', () => {
  initGame();
  setupCollisions();
});
