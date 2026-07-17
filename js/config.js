// 愤怒的猪 3D - 全局配置（单一数值来源）
// 浏览器与 Node 工具（关卡生成器/无头验证/求解器）共用本文件，保证物理与数值完全一致。
(function (root, factory) {
  const C = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = C;
  root.CONFIG = C;
})(typeof self !== 'undefined' ? self : globalThis, function () {
  return {
    // ===== 物理基础 (PRD 1.6) =====
    GRAVITY: -9.82,
    GROUND_Y: 0,
    PIG_RADIUS: 0.5,
    BIRD_RADIUS: 0.4,
    FIXED_DT: 1 / 60,
    SOLVER_ITERATIONS: 12,

    // ===== 弹弓 (PRD 5.x) =====
    SLINGSHOT_POS: { x: 2, y: 1.5, z: 0 },
    MAX_PULL: 2.5,
    LAUNCH_POWER: 16,
    TRAJECTORY_DOTS: 14,          // 轨迹预测点数 (Issue 3: 10-15)
    TRAJECTORY_DT: 0.05,          // 预测步长 → 覆盖约0.7秒

    // ===== 材质 (PRD 7.1 / Issue 1) =====
    MAT_HP: { ice: 1, wood: 3, stone: 6, tnt: 1 },
    MAT_DENSITY: { ice: 0.5, wood: 1.0, stone: 2.5, tnt: 1.0 },
    MAT_SCORE: { ice: 500, wood: 1000, stone: 2000, tnt: 300 },
    SPEED_BREAK_ICE: 5,           // 速度>5 一击碎冰
    SPEED_BREAK_WOOD: 8,          // 速度>8 一击碎木
    HIT_COOLDOWN_MS: 120,         // 同一块受击最小间隔（防一帧多次扣血）

    // ===== 炸弹猪 (PRD 7.3) =====
    EXPLOSION_RADIUS: 2.5,
    EXPLOSION_DAMAGE_CENTER: 3,   // 中心3 → 边缘1 线性衰减
    EXPLOSION_IMPULSE: 14,
    TNT_CHAIN_DELAY_MS: 90,       // TNT 链爆延迟

    // ===== 飞速猪 (PRD 6.1) =====
    SPEED_BOOST_MULT: 2.5,        // 点击后速度×2.5，持续到撞击或落地

    // ===== 分数 (PRD 8.x / Issue 2) =====
    SCORE_BIRD: 5000,
    SCORE_PRECISION: 3000,        // 精准命中（未碰建筑直接击落鸟）
    SCORE_REMAINING_PIG: 10000,
    COMBO_WINDOW_MS: 800,
    COMBO_MULT: { 2: 1.5, 3: 2, 4: 3, 5: 5 },  // ≥5 连按 ×5

    // ===== 回合判定 (Issue 6/9) =====
    PIG_STOP_SPEED: 0.1,          // 速度<0.1
    PIG_STOP_TIME_MS: 500,        // 持续0.5秒 → 回合结束
    PIG_FADE_MS: 500,             // 卡建筑淡出0.5秒
    OUT_X_MIN: -20, OUT_X_MAX: 50, OUT_Y_MIN: -6,

    // ===== 鸟 AI (PRD 6.2-6.4 / Issue 5) =====
    FLY_WANDER_RADIUS: 1.5,       // 飞鸟圆心半径
    FLY_SPEED: 0.9,               // 飘移速度
    FLY_AVOID_PAD: 0.3,           // 建筑AABB外扩缓冲
    GROUND_RUN_SPEED: 1.1,        // 站鸟跑动速度（范围=平台宽1/2，由关卡数据给 range）
    BIRD_ALERT_DIST: 3,           // 警觉
    BIRD_PANIC_DIST: 1,           // 惊恐
    BIRD_KILL_SPEED: 2.2,         // 被任何物体以超过此相对速度撞击 → 击落

    // ===== 手感 (打击感) =====
    SHAKE_MAX: 0.55,              // 震屏上限
    SHAKE_DECAY: 3.2,
    SLOWMO_SCALE: 0.3,            // 击落鸟慢动作倍率
    SLOWMO_MS: 550,
    HITSTOP_MS: 60,               // 大冲击顿帧
    HITSTOP_MIN_SPEED: 7,
    CAMERA_FOLLOW_LERP: 4.5,      // 跟随平滑系数
    CAMERA_RETURN_PAUSE_MS: 500,  // 停后停顿
    CAMERA_RETURN_MS: 1000,       // 回弹弓缓动
    PRE_SIM_SECONDS: 1.5,         // 关卡加载物理预演算

    // ===== 关卡边界 =====
    LEVEL_X_MIN: -6, LEVEL_X_MAX: 34,

    // ===== 存档 key =====
    SAVE_KEY: 'angryPigs3D_save_v3',
  };
});
