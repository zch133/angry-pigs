// 愤怒的猪 3D - 核心游戏逻辑（PRD v2.1 对齐）
// Issue 1-9 全量实现

const PIG_RADIUS = 0.5;
const BIRD_RADIUS = 0.4;
const SLINGSHOT_POS = { x: 2, y: 1.5, z: 0 };
const MAX_PULL = 2.5;
const LAUNCH_POWER = 16;
const GROUND_Y = 0;

// PRD 7.1: 材料HP值（Issue 1）
const MATERIAL_HEALTH = { ice: 1, wood: 3, stone: 6 };
const MATERIAL_DENSITY = { ice: 0.5, wood: 1.0, stone: 2.5 };
const MATERIAL_COLOR = { ice: 0x88DDFF, wood: 0xC68642, stone: 0x888888 };
const MATERIAL_SCORE = { ice: 500, wood: 1000, stone: 2000 };

// PRD 7.1: 速度阈值（Issue 1, Issue 13 速度阈值对照）
const SPEED_ONE_HIT_ICE = 5;
const SPEED_ONE_HIT_WOOD = 8;

// PRD 8.1: 分数值（Issue 2）
const SCORE_BIRD = 5000;
const SCORE_PRECISION = 3000;
const SCORE_REMAINING_PIG = 10000;

// PRD 8.2: 连击系统（Issue 2）
const COMBO_WINDOW = 800; // 0.8秒
const COMBO_MULTIPLIERS = { 2: 1.5, 3: 2.0, 4: 3.0, 5: 5.0 };

const PIG_TYPES = {
    normal: { name: '普通猪', emoji: '🐷', color: '#FFB6C1' },
    speed:  { name: '飞速猪', emoji: '💨', color: '#FFE066' },
    bomb:   { name: '炸弹猪', emoji: '💣', color: '#555555' },
};

const Game = {
    scene: null, camera: null, renderer: null, world: null, canvas: null,
    state: 'menu', currentLevel: 0, score: 0, birdsHit: 0, totalBirds: 0,
    pigQueue: [], currentPigIndex: 0, currentPigMesh: null, currentPigBody: null,
    pigLaunched: false, flyingPigs: [], birds: [], blocks: [], hills: [], debris: [], clouds: [],
    floatingTexts: [],
    isDragging: false, dragStart: { x: 0, y: 0 }, pullDist: 0, pullDir: { x: 0, z: 0 },
    cameraLocked: true, cameraAngleH: 0.6, cameraAngleV: 0.5, cameraDist: 18,
    cameraTarget: { x: 6, y: 1, z: 0 },
    cameraMode: 'slingshot', // 'slingshot' | 'follow' | 'return'
    cameraFollowTarget: null,
    cameraReturnTimer: 0,
    trailPoints: [], abilityUsed: false,
    shakeAmount: 0, slowMo: 1, slowMoTimer: 0,
    raycaster: null, plane: null,
    // Issue 2: 连击
    comboCount: 0, comboTimer: 0, comboMultiplier: 1,
    // Issue 2: 精准命中
    hitBuildingThisFlight: false,
    // Issue 3: 轨迹预测
    trajectoryDots: [],
    // Issue 7: 技能引导
    speedUsedBefore: false, bombUsedBefore: false,
    // Issue 8: 物理预演算
    preSimulating: false,
    // Issue 8: 新手引导
    showGuide: false, guideFinger: null,
    // Issue 8: 暂停
    paused: false,
};

// ==================== 初始化 ====================
function initGame() {
    Game.canvas = document.getElementById('game-canvas');
    Game.renderer = new THREE.WebGLRenderer({ canvas: Game.canvas, antialias: true });
    Game.renderer.setSize(window.innerWidth, window.innerHeight);
    Game.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    Game.renderer.shadowMap.enabled = true;
    Game.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    Game.scene = new THREE.Scene();
    Game.scene.fog = new THREE.Fog(0x64B5F6, 40, 100);

    Game.camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 200);
    updateCameraPosition();

    // 光照
    const hemi = new THREE.HemisphereLight(0x87CEEB, 0x7CB342, 0.5);
    Game.scene.add(hemi);
    Game.scene.add(new THREE.AmbientLight(0xffffff, 0.25));

    const dirLight = new THREE.DirectionalLight(0xFFFFEE, 1.0);
    dirLight.position.set(-10, 20, 8);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.left = -15;
    dirLight.shadow.camera.right = 15;
    dirLight.shadow.camera.top = 15;
    dirLight.shadow.camera.bottom = -15;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 50;
    dirLight.shadow.bias = -0.001;
    Game.scene.add(dirLight);

    const fillLight = new THREE.DirectionalLight(0xFFFFFF, 0.3);
    fillLight.position.set(10, 10, -8);
    Game.scene.add(fillLight);

    // 场景元素
    Game.scene.add(Models.createSky());
    Game.scene.add(Models.createGround());
    Game.scene.add(Models.createSun());
    Game.scene.add(Models.createMountain(-15, -15, 6));
    Game.scene.add(Models.createMountain(-8, -18, 4));
    Game.scene.add(Models.createMountain(5, -20, 5));
    Game.scene.add(Models.createMountain(15, -18, 4.5));
    Game.clouds.push(Models.createCloud(-8, 10, -5));
    Game.clouds.push(Models.createCloud(3, 12, -10));
    Game.clouds.push(Models.createCloud(12, 9, -8));
    Game.clouds.push(Models.createCloud(-3, 11, -15));
    Game.clouds.forEach(c => Game.scene.add(c));

    // 物理世界
    Game.world = new CANNON.World();
    Game.world.gravity.set(0, -20, 0);
    Game.world.broadphase = new CANNON.NaiveBroadphase();
    Game.world.solver.iterations = 12;
    Game.world.defaultContactMaterial.contactEquationStiffness = 1e7;
    Game.world.defaultContactMaterial.contactEquationRelaxation = 4;

    // 地面物理体
    const groundShape = new CANNON.Plane();
    const groundBody = new CANNON.Body({ mass: 0, shape: groundShape });
    groundBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
    Game.world.addBody(groundBody);

    // 弹弓视觉
    const slingshot = Models.createSlingshot();
    slingshot.position.set(SLINGSHOT_POS.x, GROUND_Y, SLINGSHOT_POS.z);
    Game.scene.add(slingshot);

    // 射线投射器
    Game.raycaster = new THREE.Raycaster();
    Game.plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -SLINGSHOT_POS.y);

    setupInput();
    setupUI();
    window.addEventListener('resize', onResize);

    requestAnimationFrame(gameLoop);
}

function updateCameraPosition() {
    const cx = Game.cameraTarget.x + Game.cameraDist * Math.cos(Game.cameraAngleV) * Math.sin(Game.cameraAngleH);
    const cy = Game.cameraTarget.y + Game.cameraDist * Math.sin(Game.cameraAngleV);
    const cz = Game.cameraTarget.z + Game.cameraDist * Math.cos(Game.cameraAngleV) * Math.cos(Game.cameraAngleH);
    Game.camera.position.set(cx, cy, cz);
    Game.camera.lookAt(Game.cameraTarget.x, Game.cameraTarget.y, Game.cameraTarget.z);
}

// ==================== 关卡加载 ====================
function loadLevel(idx) {
    clearLevel();
    const lv = LEVELS[idx];
    Game.currentLevel = idx;
    Game.score = 0;
    Game.birdsHit = 0;
    Game.totalBirds = lv.birds.length;
    Game.pigQueue = lv.pigTypes.map(t => ({ type: t, used: false }));
    Game.currentPigIndex = 0;
    Game.pigLaunched = false;
    Game.abilityUsed = false;
    Game.flyingPigs = [];
    Game.trailPoints = [];
    Game.comboCount = 0;
    Game.comboTimer = 0;
    Game.comboMultiplier = 1;

    // 生成鸟 (Issue 5: 飞鸟绿/站鸟橙)
    lv.birds.forEach((bd) => {
        const mesh = Models.createBird(bd.type);
        mesh.position.set(bd.x, bd.y, bd.z);
        Game.scene.add(mesh);

        const bird = {
            mesh: mesh,
            type: bd.type,
            homeX: bd.x, homeY: bd.y, homeZ: bd.z,
            range: bd.range || 1.5,
            t: Math.random() * Math.PI * 2,
            dir: 1,
            alive: true,
            falling: false,
            body: null,
            runRange: bd.range || 30,
            runOffset: 0,
        };

        if (bd.type === 'grounded') {
            bird.platformWidth = findPlatformWidth(bd.x, bd.z, lv);
            bird.runRange = bird.platformWidth / 2; // Issue 5: 1/2 平台宽度
            bird.runOffset = 0;
        }

        Game.birds.push(bird);
    });

    // 生成建筑物
    lv.blocks.forEach(bk => {
        const mesh = Models.createBlock(bk.type, bk.w, bk.h, bk.d);
        mesh.position.set(bk.x, bk.y, bk.z);
        Game.scene.add(mesh);

        const shape = new CANNON.Box(new CANNON.Vec3(bk.w / 2, bk.h / 2, bk.d / 2));
        const body = new CANNON.Body({
            mass: MATERIAL_DENSITY[bk.type],
            shape: shape,
            position: new CANNON.Vec3(bk.x, bk.y, bk.z),
            material: new CANNON.Material('block'),
        });
        body.linearDamping = 0.3;
        body.angularDamping = 0.3;
        Game.world.addBody(body);

        Game.blocks.push({
            mesh: mesh, body: body, type: bk.type,
            health: MATERIAL_HEALTH[bk.type], alive: true,
            w: bk.w, h: bk.h, d: bk.d,
        });
    });

    // 生成山坡 (Issue 8: 山坡静态碰撞体)
    if (lv.hills) {
        lv.hills.forEach(hl => {
            const mesh = Models.createHill(hl.w, hl.h, hl.d);
            mesh.position.set(hl.x, hl.y + hl.h / 2, hl.z);
            Game.scene.add(mesh);

            const shape = new CANNON.Box(new CANNON.Vec3(hl.w / 2, hl.h / 2, hl.d / 2));
            const body = new CANNON.Body({
                mass: 0,
                shape: shape,
                position: new CANNON.Vec3(hl.x, hl.y + hl.h / 2, hl.z),
            });
            Game.world.addBody(body);

            Game.hills.push({ mesh, body });
        });
    }

    // Issue 8: 物理预演算 - 1秒settle
    Game.preSimulating = true;
    document.getElementById('loading-hint').classList.remove('hidden');
    for (let i = 0; i < 60; i++) {
        Game.world.step(1 / 60);
    }
    // 同步到 mesh
    Game.blocks.forEach(b => {
        b.mesh.position.copy(b.body.position);
        b.mesh.quaternion.copy(b.body.quaternion);
    });
    Game.preSimulating = false;
    document.getElementById('loading-hint').classList.add('hidden');

    // 装填第一只猪
    loadNextPig();

    Game.state = 'playing';
    document.getElementById('hud').classList.remove('hidden');
    document.getElementById('pig-queue').classList.remove('hidden');
    document.getElementById('camera-toggle').classList.remove('hidden');
    document.getElementById('pause-btn').classList.remove('hidden');
    updateHUD();
    updatePigQueue();

    // Issue 7: 第1关新手引导
    if (idx === 0) {
        showNewbieGuide();
    }
}

function findPlatformWidth(x, z, lv) {
    let bestW = 2;
    lv.blocks.forEach(b => {
        if (Math.abs(b.x - x) < 2 && Math.abs(b.z - z) < 1 && b.h <= 0.5) {
            if (b.w > bestW) bestW = b.w;
        }
    });
    return bestW;
}

function clearLevel() {
    Game.birds.forEach(b => { if (b.mesh.parent) Game.scene.remove(b.mesh); });
    Game.blocks.forEach(b => {
        if (b.mesh.parent) Game.scene.remove(b.mesh);
        Game.world.removeBody(b.body);
    });
    Game.hills.forEach(h => {
        if (h.mesh.parent) Game.scene.remove(h.mesh);
        Game.world.removeBody(h.body);
    });
    Game.flyingPigs.forEach(p => {
        if (p.mesh.parent) Game.scene.remove(p.mesh);
        if (p.body) Game.world.removeBody(p.body);
    });
    Game.debris.forEach(d => { if (d.mesh.parent) Game.scene.remove(d.mesh); });
    Game.floatingTexts.forEach(t => { if (t.mesh.parent) Game.scene.remove(t.mesh); });
    if (Game.currentPigMesh && Game.currentPigMesh.parent) Game.scene.remove(Game.currentPigMesh);
    clearTrajectoryDots();

    Game.birds = []; Game.blocks = []; Game.hills = []; Game.flyingPigs = [];
    Game.debris = []; Game.floatingTexts = [];
    Game.currentPigMesh = null; Game.currentPigBody = null;
}

function loadNextPig() {
    if (Game.currentPigIndex >= Game.pigQueue.length) {
        checkGameOver();
        return;
    }
    const pd = Game.pigQueue[Game.currentPigIndex];
    Game.currentPigMesh = Models.createPig(pd.type);
    Game.currentPigMesh.position.set(SLINGSHOT_POS.x, SLINGSHOT_POS.y, SLINGSHOT_POS.z);
    Game.scene.add(Game.currentPigMesh);
    Game.pigLaunched = false;
    Game.abilityUsed = false;
    Game.hitBuildingThisFlight = false;
    Game.comboCount = 0;
    Game.comboTimer = 0;
    Game.comboMultiplier = 1;
    Game.cameraMode = 'slingshot';
    Game.cameraTarget = { x: 6, y: 1, z: 0 };
    updateCameraPosition();
    updatePigQueue();
    updateHUD();

    // Issue 7: 首次使用技能猪时提示
    if (pd.type === 'speed' && !Game.speedUsedBefore) {
        showSkillHint('飞速猪：飞行中点击屏幕加速冲刺！');
    } else if (pd.type === 'bomb' && !Game.bombUsedBefore) {
        showSkillHint('炸弹猪：飞行中点击屏幕爆炸！');
    }
}

// ==================== 输入处理 ====================
function setupInput() {
    const canvas = Game.canvas;

    function getPointer(e) {
        if (e.touches && e.touches.length > 0) return { x: e.touches[0].clientX, y: e.touches[0].clientY };
        if (e.changedTouches && e.changedTouches.length > 0) return { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
        return { x: e.clientX, y: e.clientY };
    }

    function onPointerDown(e) {
        if (Game.state !== 'playing' || Game.paused || Game.preSimulating) return;

        if (Game.pigLaunched) {
            // 飞行中点击：触发技能
            if (!Game.abilityUsed && Game.currentPigBody) {
                const pigData = Game.pigQueue[Game.currentPigIndex];
                if (pigData.type === 'speed') {
                    // Issue 6: 持续加速直到撞击或落地
                    const v = Game.currentPigBody.velocity;
                    const speed = Math.sqrt(v.x*v.x + v.y*v.y + v.z*v.z);
                    if (speed > 0) {
                        Game.currentPigBody.velocity.set(v.x * 2.5, v.y * 2.5, v.z * 2.5);
                    }
                    Game.abilityUsed = true;
                    Game.speedUsedBefore = true;
                    AudioSystem.boost();
                    showAbilityHint('💨 加速！');
                } else if (pigData.type === 'bomb') {
                    const pos = Game.currentPigBody.position;
                    explode(pos.x, pos.y, pos.z, 2.5);
                    removeCurrentPig(true);
                    Game.abilityUsed = true;
                    Game.bombUsedBefore = true;
                    AudioSystem.explode();
                    showAbilityHint('💥 爆炸！');
                }
            }
            return;
        }
        if (!Game.currentPigMesh) return;

        const pt = getPointer(e);
        const ndcX = (pt.x / window.innerWidth) * 2 - 1;
        const ndcY = -(pt.y / window.innerHeight) * 2 + 1;
        Game.raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), Game.camera);

        const point = new THREE.Vector3();
        Game.raycaster.ray.intersectPlane(Game.plane, point);

        if (point) {
            const dx = point.x - SLINGSHOT_POS.x;
            const dz = point.z - SLINGSHOT_POS.z;
            const dist = Math.sqrt(dx * dx + dz * dz);
            if (dist < 2.0) {
                Game.isDragging = true;
                Game.dragStart = { x: pt.x, y: pt.y };
                document.getElementById('power-indicator').style.display = 'block';
                // Issue 4: 瞄准开始时锁定相机
                Game.cameraLocked = true;
                updateCameraLockButton();
                e.preventDefault();
            }
        }
    }

    function onPointerMove(e) {
        if (!Game.isDragging) return;
        e.preventDefault();
        const pt = getPointer(e);

        const ndcX = (pt.x / window.innerWidth) * 2 - 1;
        const ndcY = -(pt.y / window.innerHeight) * 2 + 1;
        Game.raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), Game.camera);

        const point = new THREE.Vector3();
        Game.raycaster.ray.intersectPlane(Game.plane, point);

        const dx = point.x - SLINGSHOT_POS.x;
        const dz = point.z - SLINGSHOT_POS.z;
        const dist = Math.sqrt(dx * dx + dz * dz);

        if (dist > MAX_PULL) {
            const scale = MAX_PULL / dist;
            Game.pullDir = { x: dx * scale, z: dz * scale };
            Game.pullDist = MAX_PULL;
        } else {
            Game.pullDir = { x: dx, z: dz };
            Game.pullDist = dist;
        }

        Game.currentPigMesh.position.x = SLINGSHOT_POS.x - Game.pullDir.x;
        Game.currentPigMesh.position.z = SLINGSHOT_POS.z - Game.pullDir.z;
        Game.currentPigMesh.position.y = SLINGSHOT_POS.y;

        const power = Math.min(Game.pullDist / MAX_PULL, 1);
        document.getElementById('power-fill').style.width = (power * 100) + '%';

        // Issue 9: 拉伸音效
        if (Math.random() < 0.15) AudioSystem.stretch(power);

        // Issue 3: 更新轨迹预测
        updateTrajectoryPreview();
    }

    function onPointerUp(e) {
        if (!Game.isDragging) return;
        Game.isDragging = false;
        document.getElementById('power-indicator').style.display = 'none';
        clearTrajectoryDots();

        if (Game.pullDist < 0.3) {
            Game.currentPigMesh.position.set(SLINGSHOT_POS.x, SLINGSHOT_POS.y, SLINGSHOT_POS.z);
            Game.pullDist = 0;
            return;
        }

        launchPig();
    }

    canvas.addEventListener('mousedown', onPointerDown);
    canvas.addEventListener('mousemove', onPointerMove);
    canvas.addEventListener('mouseup', onPointerUp);
    canvas.addEventListener('touchstart', onPointerDown, { passive: false });
    canvas.addEventListener('touchmove', onPointerMove, { passive: false });
    canvas.addEventListener('touchend', onPointerUp);

    // Issue 4: 相机手动操作仅限装填/等待阶段
    let camDragging = false;
    let camLastX = 0, camLastY = 0;

    function canManualCamera() {
        return !Game.cameraLocked &&
               Game.state === 'playing' && !Game.paused &&
               !Game.pigLaunched && !Game.isDragging; // 仅装填/等待阶段
    }

    function onCamDown(e) {
        if (!canManualCamera()) return;
        camDragging = true;
        const pt = getPointer(e);
        camLastX = pt.x; camLastY = pt.y;
        e.preventDefault();
    }

    function onCamMove(e) {
        if (!camDragging) return;
        e.preventDefault();
        const pt = getPointer(e);
        const dx = pt.x - camLastX;
        const dy = pt.y - camLastY;
        camLastX = pt.x; camLastY = pt.y;
        Game.cameraAngleH -= dx * 0.008;
        Game.cameraAngleV = Math.max(0.15, Math.min(1.4, Game.cameraAngleV + dy * 0.008));
        updateCameraPosition();
    }

    function onCamUp() { camDragging = false; }

    canvas.addEventListener('contextmenu', e => e.preventDefault());
    canvas.addEventListener('mousedown', e => { if (e.button === 2) onCamDown(e); });
    canvas.addEventListener('mousemove', e => { if (e.button === 2 || camDragging) onCamMove(e); });
    canvas.addEventListener('mouseup', e => { if (e.button === 2) onCamUp(); });

    let pinchDist = 0;
    canvas.addEventListener('touchstart', e => {
        if (!canManualCamera()) return;
        if (e.touches.length === 2) {
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            pinchDist = Math.sqrt(dx*dx + dy*dy);
            e.preventDefault();
        }
    }, { passive: false });
    canvas.addEventListener('touchmove', e => {
        if (!canManualCamera()) return;
        if (e.touches.length === 2 && pinchDist > 0) {
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            const d = Math.sqrt(dx*dx + dy*dy);
            Game.cameraDist = Math.max(8, Math.min(35, Game.cameraDist + (pinchDist - d) * 0.05));
            pinchDist = d;
            updateCameraPosition();
            e.preventDefault();
        }
    }, { passive: false });

    canvas.addEventListener('wheel', e => {
        if (!canManualCamera()) return;
        Game.cameraDist = Math.max(8, Math.min(35, Game.cameraDist + e.deltaY * 0.02));
        updateCameraPosition();
        e.preventDefault();
    }, { passive: false });
}

// ==================== 轨迹预测 (Issue 3) ====================
function updateTrajectoryPreview() {
    clearTrajectoryDots();

    // 计算发射速度
    const power = (Game.pullDist / MAX_PULL) * LAUNCH_POWER;
    const vel = new THREE.Vector3(
        -Game.pullDir.x * LAUNCH_POWER,
        power * 0.8,
        -Game.pullDir.z * LAUNCH_POWER
    );
    const startPos = new THREE.Vector3(
        SLINGSHOT_POS.x - Game.pullDir.x,
        SLINGSHOT_POS.y,
        SLINGSHOT_POS.z - Game.pullDir.z
    );

    // 用物理公式模拟0.5秒轨迹（每隔0.04秒一个点，共12个点）
    const dt = 0.04;
    const gravity = -20;
    const damping = 0.1;
    let pos = startPos.clone();
    let velocity = vel.clone();

    for (let i = 0; i < 15; i++) {
        // 预测下一步位置
        velocity.y += gravity * dt;
        velocity.multiplyScalar(1 - damping * dt);
        pos.add(velocity.clone().multiplyScalar(dt));

        // 如果碰到地面就停
        if (pos.y < 0) break;

        const dot = Models.createTrajectoryDot();
        dot.position.copy(pos);
        // 远处的点更透明
        dot.material.opacity = Math.max(0.15, 0.6 - i * 0.03);
        Game.scene.add(dot);
        Game.trajectoryDots.push(dot);
    }
}

function clearTrajectoryDots() {
    Game.trajectoryDots.forEach(d => { if (d.parent) Game.scene.remove(d); });
    Game.trajectoryDots = [];
}

// ==================== 发射 ====================
function launchPig() {
    const pigData = Game.pigQueue[Game.currentPigIndex];
    const mesh = Game.currentPigMesh;

    const shape = new CANNON.Sphere(PIG_RADIUS);
    const body = new CANNON.Body({
        mass: 1.5,
        shape: shape,
        position: new CANNON.Vec3(mesh.position.x, mesh.position.y, mesh.position.z),
        material: new CANNON.Material('pig'),
    });
    body.linearDamping = 0.1;

    const power = (Game.pullDist / MAX_PULL) * LAUNCH_POWER;
    body.velocity.set(-Game.pullDir.x * LAUNCH_POWER, power * 0.8, -Game.pullDir.z * LAUNCH_POWER);

    Game.world.addBody(body);

    Game.currentPigBody = body;
    Game.pigLaunched = true;
    Game.trailPoints = [];
    Game.hitBuildingThisFlight = false;
    Game.comboCount = 0;
    Game.comboTimer = 0;

    // Issue 4: 切换相机到跟随模式
    Game.cameraMode = 'follow';
    Game.cameraFollowTarget = body;

    Game.flyingPigs.push({
        mesh: mesh, body: body, type: pigData.type,
        launched: true, stopped: false, stopTime: 0,
        stuckFadeTimer: 0, // Issue 6: 卡住淡出
        prevPos: { x: mesh.position.x, y: mesh.position.y, z: mesh.position.z },
    });

    AudioSystem.launch();
    Game.pullDist = 0;

    // 技能提示
    if (pigData.type === 'speed' || pigData.type === 'bomb') {
        const ah = document.getElementById('ability-hint');
        ah.textContent = pigData.type === 'speed' ? '点击屏幕加速！' : '点击屏幕爆炸！';
        ah.style.display = 'block';
        setTimeout(() => { ah.style.display = 'none'; }, 2500);
    }

    // 隐藏新手引导
    hideNewbieGuide();
}

function removeCurrentPig(immediate) {
    if (Game.currentPigBody) {
        if (immediate) {
            Game.world.removeBody(Game.currentPigBody);
            Game.currentPigBody = null;
        }
        // Issue 6: 非立即时由 updateFlyingPig 处理淡出
    }
    const flying = Game.flyingPigs.find(p => p.mesh === Game.currentPigMesh);
    if (flying) flying.stopped = true;
}

// ==================== 碰撞 ====================
function setupCollisionHandler() {
    setTimeout(() => {
        if (!Game.world) return;
        Game.world.addEventListener('postStep', checkCollisions);
    }, 100);
}

function checkCollisions() {
    if (Game.state !== 'playing' || Game.paused) return;

    const contacts = Game.world.contacts;
    for (let i = 0; i < contacts.length; i++) {
        const c = contacts[i];
        if (!c.bi || !c.bj) continue;

        const bodyA = c.bi;
        const bodyB = c.bj;

        const pigFlying = Game.flyingPigs.find(p => p.body === bodyA || p.body === bodyB);
        if (!pigFlying || pigFlying.stopped) continue;

        const otherBody = (pigFlying.body === bodyA) ? bodyB : bodyA;

        // 撞建筑物 (Issue 1: 阈值伤害模型)
        const block = Game.blocks.find(b => b.body === otherBody && b.alive);
        if (block) {
            const relVel = pigFlying.body.velocity;
            const speed = Math.sqrt(relVel.x*relVel.x + relVel.y*relVel.y + relVel.z*relVel.z);

            if (speed > 2) {
                Game.hitBuildingThisFlight = true; // 标记本次飞行碰过建筑

                if (block.type === 'ice' && speed > SPEED_ONE_HIT_ICE) {
                    // 冰：速度>5一击碎裂
                    destroyBlock(block);
                } else if (block.type === 'wood' && speed > SPEED_ONE_HIT_WOOD) {
                    // 木：速度>8一击碎裂
                    destroyBlock(block);
                } else {
                    // 每次撞击扣1HP
                    block.health -= 1;
                    if (block.health <= 0) {
                        destroyBlock(block);
                    } else {
                        if (block.type === 'ice') AudioSystem.iceBreak();
                        else if (block.type === 'wood') AudioSystem.woodHit();
                        else AudioSystem.stoneHit();
                    }
                }
                Game.shakeAmount = Math.min(speed * 0.3, 3);
            }
        }

        // 撞鸟
        const bird = Game.birds.find(b => b.body === otherBody && b.alive);
        if (bird) {
            hitBird(bird);
        }
    }

    // 连续碰撞检测：飞行猪碰鸟（线段-球体相交，防止高速漏帧）
    Game.flyingPigs.forEach(pig => {
        if (!pig.body || pig.stopped) return;
        const pp = pig.body.position;
        const prev = pig.prevPos || { x: pp.x, y: pp.y, z: pp.z };
        pig.prevPos = { x: pp.x, y: pp.y, z: pp.z };

        Game.birds.forEach(bird => {
            if (!bird.alive || bird.falling) return;
            const bp = bird.mesh.position;
            // 线段(prev→pp)与球体(中心bp, 碰撞半径)相交检测
            // 碰撞半径比物理半径稍大，提升手感
            const r = PIG_RADIUS + BIRD_RADIUS + 0.3;
            const dx = pp.x - prev.x, dy = pp.y - prev.y, dz = pp.z - prev.z;
            const fx = prev.x - bp.x, fy = prev.y - bp.y, fz = prev.z - bp.z;
            const a = dx*dx + dy*dy + dz*dz;
            const b = 2*(fx*dx + fy*dy + fz*dz);
            const c = fx*fx + fy*fy + fz*fz - r*r;
            const disc = b*b - 4*a*c;
            if (disc < 0 || a < 0.0001) return;
            const t = (-b - Math.sqrt(disc)) / (2*a);
            if (t >= 0 && t <= 1) {
                hitBird(bird);
            }
        });
    });
}

function hitBird(bird) {
    bird.alive = false;
    bird.falling = true;

    // Issue 5: 鸟表情 - 被击中
    Models.setBirdExpression(bird.mesh, 'hit');

    const shape = new CANNON.Sphere(BIRD_RADIUS);
    const body = new CANNON.Body({
        mass: 0.5,
        shape: shape,
        position: new CANNON.Vec3(bird.mesh.position.x, bird.mesh.position.y, bird.mesh.position.z),
        material: new CANNON.Material('bird'),
    });
    body.linearDamping = 0.2;
    body.angularDamping = 0.2;
    Game.world.addBody(body);
    bird.body = body;

    Game.birdsHit++;

    // Issue 2: 连击系统（只计算鸟）
    Game.comboCount++;
    Game.comboTimer = COMBO_WINDOW;
    const mult = COMBO_MULTIPLIERS[Game.comboCount] || 1.0;
    Game.comboMultiplier = mult;

    let birdScore = SCORE_BIRD;
    // Issue 2: 精准命中奖励
    if (!Game.hitBuildingThisFlight) {
        birdScore += SCORE_PRECISION;
    }
    birdScore = Math.floor(birdScore * mult);
    Game.score += birdScore;

    // Issue 7: 飘字
    spawnFloatingText(bird.mesh.position.x, bird.mesh.position.y + 0.5, bird.mesh.position.z,
        '+' + birdScore, 0xFFD700);

    // Issue 7: 连击飘字
    if (Game.comboCount >= 2) {
        spawnComboText(mult);
        AudioSystem.combo(Game.comboCount);
    }

    Game.shakeAmount = 5;
    Game.slowMo = 0.3;
    Game.slowMoTimer = 200;

    AudioSystem.birdHit();
    updateHUD();

    setTimeout(() => {
        if (bird.mesh.parent) Game.scene.remove(bird.mesh);
        if (bird.body) Game.world.removeBody(bird.body);
        bird.falling = false;
        checkWin();
    }, 2500);
}

function destroyBlock(block) {
    block.alive = false;
    if (block.mesh.parent) Game.scene.remove(block.mesh);
    Game.world.removeBody(block.body);

    // 碎片
    for (let i = 0; i < 8; i++) {
        const d = Models.createDebris(MATERIAL_COLOR[block.type], 0.12 + Math.random() * 0.08);
        d.position.set(
            block.mesh.position.x + (Math.random() - 0.5) * 0.5,
            block.mesh.position.y + (Math.random() - 0.5) * 0.5,
            block.mesh.position.z + (Math.random() - 0.5) * 0.5
        );
        Game.scene.add(d);
        Game.debris.push({
            mesh: d,
            vx: (Math.random() - 0.5) * 8,
            vy: Math.random() * 6 + 2,
            vz: (Math.random() - 0.5) * 8,
            life: 1.5,
        });
    }

    // Issue 2: 建筑物分数（不受连击影响）
    const score = MATERIAL_SCORE[block.type];
    Game.score += score;
    // Issue 7: 飘字
    spawnFloatingText(block.mesh.position.x, block.mesh.position.y + 0.3, block.mesh.position.z,
        '+' + score, block.type === 'ice' ? 0x88DDFF : block.type === 'wood' ? 0xC68642 : 0xAAAAAA);

    if (block.type === 'ice') AudioSystem.iceBreak();
    else if (block.type === 'wood') AudioSystem.woodHit();
    else AudioSystem.stoneHit();

    updateHUD();
}

// Issue 1 & 6: 炸弹猪爆炸 - 固定3点伤害，线性衰减
function explode(x, y, z, radius) {
    Game.shakeAmount = 8;
    Game.slowMo = 0.2;
    Game.slowMoTimer = 300;

    // 爆炸碎片
    for (let i = 0; i < 20; i++) {
        const d = Models.createDebris(0xFF6600, 0.15 + Math.random() * 0.1);
        d.position.set(x, y, z);
        Game.scene.add(d);
        Game.debris.push({
            mesh: d,
            vx: (Math.random() - 0.5) * 15,
            vy: Math.random() * 10 + 3,
            vz: (Math.random() - 0.5) * 15,
            life: 1.0,
        });
    }

    // 对范围内建筑物：固定3点伤害，线性衰减
    Game.blocks.forEach(block => {
        if (!block.alive) return;
        const bp = block.body.position;
        const dx = bp.x - x;
        const dy = bp.y - y;
        const dz = bp.z - z;
        const d = Math.sqrt(dx*dx + dy*dy + dz*dz);
        if (d < radius) {
            // 线性衰减：中心3点 → 边缘1点
            const damage = 3 - (d / radius) * 2; // 3 at center, 1 at edge
            const intDamage = Math.ceil(damage);

            // 物理推力
            const force = (1 - d / radius) * 30;
            block.body.applyImpulse(
                new CANNON.Vec3(dx/d * force, dy/d * force + 5, dz/d * force),
                new CANNON.Vec3(0, 0, 0)
            );

            block.health -= intDamage;
            if (block.health <= 0) destroyBlock(block);
        }
    });

    // 对范围内鸟：直接击落
    Game.birds.forEach(bird => {
        if (!bird.alive) return;
        const bp = bird.mesh.position;
        const dx = bp.x - x;
        const dy = bp.y - y;
        const dz = bp.z - z;
        const d = Math.sqrt(dx*dx + dy*dy + dz*dz);
        if (d < radius) {
            hitBird(bird);
        }
    });
}

// ==================== 飘字系统 (Issue 7) ====================
function spawnFloatingText(x, y, z, text, color) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.font = 'bold 36px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 4;
    ctx.strokeText(text, 128, 32);
    const hex = '#' + color.toString(16).padStart(6, '0');
    ctx.fillStyle = hex;
    ctx.fillText(text, 128, 32);

    const texture = new THREE.CanvasTexture(canvas);
    const mat = new THREE.SpriteMaterial({ map: texture, transparent: true });
    const sprite = new THREE.Sprite(mat);
    sprite.position.set(x, y, z);
    sprite.scale.set(2, 0.5, 1);
    Game.scene.add(sprite);

    Game.floatingTexts.push({
        mesh: sprite,
        life: 1.5,
        vy: 2,
    });
}

function spawnComboText(multiplier) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 96;
    const ctx = canvas.getContext('2d');
    ctx.font = 'bold 56px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const text = 'x' + multiplier;
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 6;
    ctx.strokeText(text, 128, 48);
    const colors = { 1.5: '#FFEB3B', 2.0: '#FF9800', 3.0: '#F44336', 5.0: '#9C27B0' };
    ctx.fillStyle = colors[multiplier] || '#FFEB3B';
    ctx.fillText(text, 128, 48);

    const texture = new THREE.CanvasTexture(canvas);
    const mat = new THREE.SpriteMaterial({ map: texture, transparent: true });
    const sprite = new THREE.Sprite(mat);

    // 放在屏幕中央偏上
    sprite.position.set(Game.camera.position.x + Game.camera.getWorldDirection(new THREE.Vector3()).x * 5,
        Game.camera.position.y + 2, Game.camera.position.z + Game.camera.getWorldDirection(new THREE.Vector3()).z * 5);
    sprite.scale.set(3, 1.2, 1);
    Game.scene.add(sprite);

    Game.floatingTexts.push({
        mesh: sprite,
        life: 0.8,
        vy: 1,
        isCombo: true,
    });
}

function updateFloatingTexts(dt) {
    const dts = dt / 1000;
    for (let i = Game.floatingTexts.length - 1; i >= 0; i--) {
        const t = Game.floatingTexts[i];
        t.mesh.position.y += t.vy * dts;
        t.life -= dts;
        if (t.mesh.material) {
            t.mesh.material.opacity = Math.max(0, t.life / (t.isCombo ? 0.8 : 1.5));
        }
        if (t.life <= 0) {
            if (t.mesh.parent) Game.scene.remove(t.mesh);
            Game.floatingTexts.splice(i, 1);
        }
    }
}

// ==================== 更新 ====================
function syncPhysics() {
    Game.blocks.forEach(b => {
        if (!b.alive) return;
        b.mesh.position.copy(b.body.position);
        b.mesh.quaternion.copy(b.body.quaternion);
    });

    Game.flyingPigs.forEach(p => {
        if (p.body && p.mesh) {
            p.mesh.position.copy(p.body.position);
            p.mesh.quaternion.copy(p.body.quaternion);
        }
    });

    Game.birds.forEach(b => {
        if (b.body && b.falling) {
            b.mesh.position.copy(b.body.position);
            b.mesh.quaternion.copy(b.body.quaternion);
        }
    });
}

function updateBirds(dt) {
    Game.birds.forEach(b => {
        if (!b.alive) return;
        if (b.falling) return;

        if (b.type === 'flying') {
            b.t += dt * 0.001;
            const angle = b.t;
            const r = b.range * (0.5 + 0.5 * Math.sin(b.t * 0.7));
            const nx = b.homeX + Math.cos(angle) * r;
            const nz = b.homeZ + Math.sin(angle) * r;
            const ny = b.homeY + Math.sin(b.t * 1.3) * 0.3;

            // Issue 5: 飞鸟边界 = 圆心半径 + 建筑AABB外扩0.3缓冲区
            let blocked = false;
            Game.blocks.forEach(blk => {
                if (!blk.alive) return;
                const bp = blk.body.position;
                const bw = blk.w / 2 + 0.3;
                const bh = blk.h / 2 + 0.3;
                const bd = blk.d / 2 + 0.3;
                if (Math.abs(bp.x - nx) < bw && Math.abs(bp.z - nz) < bd && Math.abs(bp.y - ny) < bh) {
                    blocked = true;
                }
            });
            if (blocked) {
                b.t += Math.PI * (0.5 + Math.random() * 0.5);
            } else {
                b.mesh.position.set(nx, ny, nz);
            }

            if (b.mesh.userData.wings) {
                const flap = Math.sin(Date.now() * 0.01) * 0.3;
                b.mesh.userData.wings[0].rotation.z = flap;
                b.mesh.userData.wings[1].rotation.z = -flap;
            }
            b.mesh.rotation.y = angle + Math.PI / 2;

            // Issue 5: 鸟表情 - 根据猪距离
            if (Game.currentPigBody && Game.pigLaunched) {
                const pp = Game.currentPigBody.position;
                const bp = b.mesh.position;
                const dist = Math.sqrt((pp.x-bp.x)**2 + (pp.y-bp.y)**2 + (pp.z-bp.z)**2);
                if (dist < 1.0) Models.setBirdExpression(b.mesh, 'panic');
                else if (dist < 3.0) Models.setBirdExpression(b.mesh, 'alert');
                else Models.setBirdExpression(b.mesh, 'normal');
            } else {
                Models.setBirdExpression(b.mesh, 'normal');
            }

        } else if (b.type === 'grounded') {
            // Issue 5: 站鸟 1/2 平台宽度
            b.t += dt * 0.002 * b.dir;
            const offset = Math.sin(b.t) * b.runRange;
            b.mesh.position.x = b.homeX + offset;
            b.mesh.position.y = b.homeY + Math.abs(Math.sin(b.t * 2)) * 0.1;
            b.mesh.rotation.y = b.dir > 0 ? Math.PI / 2 : -Math.PI / 2;

            if (Math.abs(offset) >= b.runRange * 0.95) {
                b.dir *= -1;
            }

            // Issue 5: 站鸟表情
            if (Game.currentPigBody && Game.pigLaunched) {
                const pp = Game.currentPigBody.position;
                const bp = b.mesh.position;
                const dist = Math.sqrt((pp.x-bp.x)**2 + (pp.y-bp.y)**2 + (pp.z-bp.z)**2);
                if (dist < 1.0) Models.setBirdExpression(b.mesh, 'panic');
                else if (dist < 3.0) Models.setBirdExpression(b.mesh, 'alert');
                else Models.setBirdExpression(b.mesh, 'normal');
            } else {
                Models.setBirdExpression(b.mesh, 'normal');
            }
        }
    });
}

function checkFlyingPig(dt) {
    Game.flyingPigs.forEach(pig => {
        if (!pig.body || pig.stopped) {
            // Issue 6: 卡住淡出处理
            if (pig.stuckFadeTimer > 0) {
                pig.stuckFadeTimer -= dt;
                if (pig.mesh) {
                    const opacity = Math.max(0, pig.stuckFadeTimer / 500);
                    pig.mesh.traverse(child => {
                        if (child.material) {
                            child.material.transparent = true;
                            child.material.opacity = opacity;
                        }
                    });
                }
                if (pig.stuckFadeTimer <= 0) {
                    if (pig.mesh.parent) Game.scene.remove(pig.mesh);
                    if (pig.body) {
                        // Issue 6: 物理体延迟移除（让上方建筑自然下沉）
                        setTimeout(() => {
                            if (pig.body) Game.world.removeBody(pig.body);
                            pig.body = null;
                        }, 500);
                    }
                    proceedToNextPig();
                }
            }
            return;
        }

        const v = pig.body.velocity;
        const speed = Math.sqrt(v.x*v.x + v.y*v.y + v.z*v.z);

        // 记录轨迹
        if (speed > 1) {
            Game.trailPoints.push({
                x: pig.body.position.x,
                y: pig.body.position.y,
                z: pig.body.position.z,
                life: 1.0,
            });
            if (Game.trailPoints.length > 50) Game.trailPoints.shift();
        }

        // Issue 6: 停止判定 - 速度<0.1 持续0.5秒
        if (speed < 0.1) {
            pig.stopTime += dt;
            if (pig.stopTime > 500) {
                pig.stopped = true;
                pig.stuckFadeTimer = 500; // Issue 6: 0.5秒淡出动画
            }
        } else {
            pig.stopTime = 0;
        }

        // 出界
        if (pig.body.position.y < -5 || Math.abs(pig.body.position.x) > 30) {
            pig.stopped = true;
            if (pig.mesh.parent) Game.scene.remove(pig.mesh);
            Game.world.removeBody(pig.body);
            pig.body = null;
            proceedToNextPig();
        }

        // Issue 4: 相机跟随
        if (Game.cameraMode === 'follow' && Game.cameraFollowTarget === pig.body && !pig.stopped) {
            const pp = pig.body.position;
            // 平滑跟随
            Game.cameraTarget.x += (pp.x - Game.cameraTarget.x) * 0.08;
            Game.cameraTarget.y += (pp.y + 1 - Game.cameraTarget.y) * 0.08;
            Game.cameraTarget.z += (pp.z - Game.cameraTarget.z) * 0.08;
            updateCameraPosition();
        }
    });
}

function proceedToNextPig() {
    if (Game.cameraMode === 'follow') {
        // Issue 4: 回到弹弓视角
        Game.cameraMode = 'return';
        Game.cameraReturnTimer = 1000;
    }
    Game.currentPigIndex++;
    setTimeout(() => {
        if (Game.state === 'playing' && !Game.paused) loadNextPig();
    }, 500);
}

// Issue 2: 连击计时器
function updateCombo(dt) {
    if (Game.comboTimer > 0) {
        Game.comboTimer -= dt;
        if (Game.comboTimer <= 0) {
            Game.comboCount = 0;
            Game.comboMultiplier = 1;
        }
    }
}

function updateDebris(dt) {
    const dts = dt / 1000;
    for (let i = Game.debris.length - 1; i >= 0; i--) {
        const d = Game.debris[i];
        d.mesh.position.x += d.vx * dts;
        d.mesh.position.y += d.vy * dts;
        d.mesh.position.z += d.vz * dts;
        d.vy -= 15 * dts;
        d.mesh.rotation.x += dts * 5;
        d.mesh.rotation.y += dts * 4;
        d.life -= dts;
        if (d.life <= 0 || d.mesh.position.y < -1) {
            if (d.mesh.parent) Game.scene.remove(d.mesh);
            Game.debris.splice(i, 1);
        }
    }
}

function updateClouds(dt) {
    Game.clouds.forEach(c => {
        c.position.x += c.userData.driftSpeed * (dt / 16);
        if (c.position.x > 25) c.position.x = -25;
    });
}

function drawTrail() {
    Game.trailPoints.forEach(p => p.life -= 0.02);
    Game.trailPoints = Game.trailPoints.filter(p => p.life > 0);

    if (Game.trailPoints.length < 2) {
        if (Game.trailMesh) {
            Game.scene.remove(Game.trailMesh);
            Game.trailMesh = null;
        }
        return;
    }
    if (!Game.trailMesh) {
        const geo = new THREE.BufferGeometry();
        const mat = new THREE.PointsMaterial({
            color: 0xFFB6C1, size: 0.15, transparent: true, opacity: 0.6, sizeAttenuation: true
        });
        Game.trailMesh = new THREE.Points(geo, mat);
        Game.scene.add(Game.trailMesh);
    }
    const positions = new Float32Array(Game.trailPoints.length * 3);
    Game.trailPoints.forEach((p, i) => {
        positions[i*3] = p.x;
        positions[i*3+1] = p.y;
        positions[i*3+2] = p.z;
    });
    Game.trailMesh.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    Game.trailMesh.geometry.attributes.position.needsUpdate = true;
}

// Issue 4: 相机回程动画
function updateCameraReturn(dt) {
    if (Game.cameraMode !== 'return') return;
    const target = { x: 6, y: 1, z: 0 };
    Game.cameraTarget.x += (target.x - Game.cameraTarget.x) * 0.05;
    Game.cameraTarget.y += (target.y - Game.cameraTarget.y) * 0.05;
    Game.cameraTarget.z += (target.z - Game.cameraTarget.z) * 0.05;
    updateCameraPosition();

    Game.cameraReturnTimer -= dt;
    if (Game.cameraReturnTimer <= 0) {
        Game.cameraMode = 'slingshot';
        Game.cameraTarget = target;
        updateCameraPosition();
    }
}

// ==================== 新手引导 (Issue 7) ====================
function showNewbieGuide() {
    Game.showGuide = true;
    const guide = document.getElementById('newbie-guide');
    if (guide) guide.classList.remove('hidden');
}

function hideNewbieGuide() {
    Game.showGuide = false;
    const guide = document.getElementById('newbie-guide');
    if (guide) guide.classList.add('hidden');
}

function showSkillHint(text) {
    const el = document.getElementById('skill-hint');
    if (!el) return;
    el.textContent = text;
    el.classList.remove('hidden');
    setTimeout(() => el.classList.add('hidden'), 3000);
}

function showAbilityHint(text) {
    const el = document.getElementById('ability-hint');
    el.textContent = text;
    el.style.display = 'block';
    setTimeout(() => { el.style.display = 'none'; }, 1500);
}

// ==================== 胜负判定 ====================
function checkWin() {
    if (Game.birdsHit >= Game.totalBirds) {
        Game.state = 'win';
        // Issue 2: 剩余猪奖励
        const remaining = Game.pigQueue.length - Game.currentPigIndex - 1;
        if (remaining > 0) {
            Game.score += remaining * SCORE_REMAINING_PIG;
        }
        showResult(true);
    }
}

function checkGameOver() {
    if (Game.birdsHit < Game.totalBirds) {
        Game.state = 'lose';
        showResult(false);
    }
}

function showResult(win) {
    document.getElementById('hud').classList.add('hidden');
    document.getElementById('pig-queue').classList.add('hidden');
    document.getElementById('pause-btn').classList.add('hidden');
    const screen = document.getElementById('result-screen');
    const title = document.getElementById('result-title');
    const stars = document.getElementById('result-stars');
    const scoreEl = document.getElementById('result-score');
    const btnNext = document.getElementById('btn-next');

    if (win) {
        title.textContent = '🎉 通关！';
        title.style.color = '#4CAF50';

        const lv = LEVELS[Game.currentLevel];
        let starCount = 1;
        if (Game.score >= lv.twoStar) starCount = 2;
        if (Game.score >= lv.threeStar) starCount = 3;
        stars.textContent = '⭐'.repeat(starCount) + '☆'.repeat(3 - starCount);
        scoreEl.textContent = '分数: ' + Game.score;

        saveProgress(Game.currentLevel, Game.score, starCount);

        if (Game.currentLevel < LEVELS.length - 1) {
            btnNext.style.display = '';
        } else {
            btnNext.style.display = 'none';
            title.textContent = '🏆 全部通关！';
        }
        AudioSystem.win();
    } else {
        title.textContent = '😢 失败了';
        title.style.color = '#F44336';
        stars.textContent = '☆☆☆';
        scoreEl.textContent = '分数: ' + Game.score;
        btnNext.style.display = 'none';
        AudioSystem.lose();
    }

    screen.classList.remove('hidden');
}

// ==================== 存档 ====================
function getSave() {
    try {
        const d = localStorage.getItem('angryPigs3D_save');
        if (d) return JSON.parse(d);
    } catch(e) {}
    return { unlocked: 1, scores: {}, stars: {} };
}

function saveProgress(levelIdx, score, stars) {
    const save = getSave();
    if (levelIdx + 2 > save.unlocked) save.unlocked = levelIdx + 2;
    if (levelIdx + 2 > LEVELS.length) save.unlocked = LEVELS.length;
    const key = String(levelIdx);
    if (!save.scores[key] || score > save.scores[key]) save.scores[key] = score;
    if (!save.stars[key] || stars > save.stars[key]) save.stars[key] = stars;
    try { localStorage.setItem('angryPigs3D_save', JSON.stringify(save)); } catch(e) {}
}

// ==================== UI ====================
function setupUI() {
    document.getElementById('btn-start').addEventListener('click', () => {
        AudioSystem.click();
        const save = getSave();
        loadLevel(save.unlocked - 1);
        document.getElementById('menu-screen').classList.add('hidden');
    });

    document.getElementById('btn-levels').addEventListener('click', () => {
        AudioSystem.click();
        showLevelSelect();
    });

    document.getElementById('btn-back-menu').addEventListener('click', () => {
        AudioSystem.click();
        document.getElementById('level-select-screen').classList.add('hidden');
        document.getElementById('menu-screen').classList.remove('hidden');
    });

    document.getElementById('btn-next').addEventListener('click', () => {
        AudioSystem.click();
        document.getElementById('result-screen').classList.add('hidden');
        loadLevel(Game.currentLevel + 1);
    });

    document.getElementById('btn-retry').addEventListener('click', () => {
        AudioSystem.click();
        document.getElementById('result-screen').classList.add('hidden');
        loadLevel(Game.currentLevel);
    });

    document.getElementById('btn-menu').addEventListener('click', () => {
        AudioSystem.click();
        document.getElementById('result-screen').classList.add('hidden');
        document.getElementById('menu-screen').classList.remove('hidden');
        document.getElementById('camera-toggle').classList.add('hidden');
        document.getElementById('pause-btn').classList.add('hidden');
        Game.state = 'menu';
    });

    // 相机按钮
    document.getElementById('camera-toggle').addEventListener('click', () => {
        // Issue 4: 飞行中不能解锁
        if (Game.pigLaunched || Game.isDragging) return;
        Game.cameraLocked = !Game.cameraLocked;
        updateCameraLockButton();
        AudioSystem.click();
    });

    // Issue 8: 暂停按钮
    document.getElementById('pause-btn').addEventListener('click', () => {
        AudioSystem.click();
        togglePause();
    });

    document.getElementById('btn-resume').addEventListener('click', () => {
        AudioSystem.click();
        togglePause();
    });

    document.getElementById('btn-pause-restart').addEventListener('click', () => {
        AudioSystem.click();
        document.getElementById('pause-screen').classList.add('hidden');
        Game.paused = false;
        loadLevel(Game.currentLevel);
    });

    document.getElementById('btn-pause-menu').addEventListener('click', () => {
        AudioSystem.click();
        document.getElementById('pause-screen').classList.add('hidden');
        document.getElementById('menu-screen').classList.remove('hidden');
        document.getElementById('camera-toggle').classList.add('hidden');
        document.getElementById('pause-btn').classList.add('hidden');
        Game.state = 'menu';
        Game.paused = false;
    });

    // 音量滑块
    const volSlider = document.getElementById('vol-slider');
    if (volSlider) {
        volSlider.addEventListener('input', (e) => {
            AudioSystem.setVolume(parseFloat(e.target.value) / 100);
        });
    }
}

function updateCameraLockButton() {
    const btn = document.getElementById('camera-toggle');
    if (Game.cameraLocked) {
        btn.classList.remove('unlocked');
        btn.classList.add('locked');
        btn.textContent = '🔒';
        btn.title = '点击解锁相机旋转（仅装填/等待阶段可用）';
    } else {
        btn.classList.remove('locked');
        btn.classList.add('unlocked');
        btn.textContent = '🔓';
        btn.title = '点击锁定相机';
    }
}

function togglePause() {
    if (Game.state !== 'playing') return;
    Game.paused = !Game.paused;
    const screen = document.getElementById('pause-screen');
    if (Game.paused) {
        screen.classList.remove('hidden');
    } else {
        screen.classList.add('hidden');
    }
}

function showLevelSelect() {
    const grid = document.getElementById('level-grid');
    grid.innerHTML = '';
    const save = getSave();

    LEVELS.forEach((lv, i) => {
        const card = document.createElement('div');
        card.className = 'level-card';
        const isUnlocked = (i + 1) <= save.unlocked;
        if (!isUnlocked) card.classList.add('locked');
        const stars = save.stars[String(i)] || 0;
        card.innerHTML = `<div>${i + 1}</div><div class="stars">${'⭐'.repeat(stars)}${'☆'.repeat(3 - stars)}</div>`;
        if (isUnlocked) {
            card.addEventListener('click', () => {
                AudioSystem.click();
                document.getElementById('level-select-screen').classList.add('hidden');
                loadLevel(i);
            });
        }
        grid.appendChild(card);
    });

    document.getElementById('menu-screen').classList.add('hidden');
    document.getElementById('level-select-screen').classList.remove('hidden');
}

function updateHUD() {
    document.getElementById('score').textContent = Game.score;
    document.getElementById('pigs-left').textContent = Game.pigQueue.length - Game.currentPigIndex;
    document.getElementById('level-num').textContent = Game.currentLevel + 1;
    if (Game.currentPigIndex < Game.pigQueue.length) {
        const pt = PIG_TYPES[Game.pigQueue[Game.currentPigIndex].type];
        document.getElementById('pig-type').textContent = pt.name;
    }
}

function updatePigQueue() {
    const q = document.getElementById('pig-queue');
    q.innerHTML = '';
    Game.pigQueue.forEach((pd, i) => {
        const icon = document.createElement('div');
        icon.className = 'pig-queue-icon';
        if (i === Game.currentPigIndex) icon.classList.add('current');
        if (i < Game.currentPigIndex) icon.style.opacity = '0.25';
        icon.textContent = PIG_TYPES[pd.type].emoji;
        icon.style.background = PIG_TYPES[pd.type].color;
        q.appendChild(icon);
    });
}

// ==================== 主循环 ====================
let lastTime = 0;
function gameLoop(time) {
    requestAnimationFrame(gameLoop);
    const dt = Math.min(time - lastTime, 50);
    lastTime = time;

    if (Game.state === 'playing' && !Game.paused && !Game.preSimulating) {
        const stepDt = (dt / 1000) * Game.slowMo;
        Game.world.step(1/60, stepDt, 3);
        syncPhysics();
        updateBirds(dt);
        checkFlyingPig(dt);
        updateDebris(dt);
        drawTrail();
        updateCombo(dt);
        updateFloatingTexts(dt);
        updateCameraReturn(dt);

        if (Game.currentPigMesh && !Game.pigLaunched) {
            Game.currentPigMesh.rotation.y = Math.sin(Date.now() * 0.002) * 0.15;
            Game.currentPigMesh.position.y = SLINGSHOT_POS.y + Math.sin(Date.now() * 0.003) * 0.03;
        }

        // 新手引导手指动画
        if (Game.showGuide && Game.guideFinger) {
            const t = Date.now() * 0.002;
            Game.guideFinger.position.x = SLINGSHOT_POS.x - Math.sin(t) * 1.5;
            Game.guideFinger.position.y = SLINGSHOT_POS.y;
            Game.guideFinger.position.z = SLINGSHOT_POS.z - Math.cos(t) * 1.5;
        }
    }

    updateClouds(dt);

    // 慢动作恢复
    if (Game.slowMoTimer > 0) {
        Game.slowMoTimer -= dt;
        if (Game.slowMoTimer <= 0) Game.slowMo = 1;
    }

    // 震动
    if (Game.shakeAmount > 0.1) {
        Game.camera.position.x += (Math.random() - 0.5) * Game.shakeAmount * 0.05;
        Game.camera.position.y += (Math.random() - 0.5) * Game.shakeAmount * 0.05;
        Game.shakeAmount *= 0.85;
    }

    Game.renderer.render(Game.scene, Game.camera);
}

function onResize() {
    Game.camera.aspect = window.innerWidth / window.innerHeight;
    Game.camera.updateProjectionMatrix();
    Game.renderer.setSize(window.innerWidth, window.innerHeight);
}

// ==================== 启动 ====================
window.addEventListener('load', () => {
    initGame();
    setupCollisionHandler();
});
