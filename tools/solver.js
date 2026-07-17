// 自动求解器 — 证明"用关卡给定的猪与顺序可以全歼鸟"
// 策略：解析弹道预筛 → 物理精评候选 → 贪心选最优 → 快照回溯
const { Sim, C } = require('./headless_sim.js');

const SLING = C.SLINGSHOT_POS;
const MAXV = C.MAX_PULL * C.LAUNCH_POWER; // 40

// 解析弹道：从 pull 出发的抛物线与目标的最小距离
function ballisticMinDist(pull, targets, opts = {}) {
  let vx = -pull.x * C.LAUNCH_POWER, vy = -pull.y * C.LAUNCH_POWER, vz = -pull.z * C.LAUNCH_POWER;
  let px = SLING.x, py = SLING.y, pz = SLING.z;
  const dt = 0.04;
  let best = { d: 1e9, t: 0, target: null };
  for (let t = 0; t < 3.2; t += dt) {
    px += vx * dt; py += vy * dt; pz += vz * dt;
    vy += C.GRAVITY * dt;
    if (py < 0) break;
    for (const tg of targets) {
      const d = Math.hypot(px - tg.x, py - tg.y, pz - tg.z) - (tg.r || 0);
      if (d < best.d) best = { d, t, target: tg };
    }
  }
  return best;
}

// 生成候选 pull 向量
function candidates(sim) {
  const targets = [];
  for (const b of sim.birds) if (b.alive) targets.push({ x: b.x, y: b.y, z: b.z, r: C.BIRD_RADIUS + 0.55, bird: true });
  for (const b of sim.blocks) if (!b.dead && b.body) targets.push({ x: b.body.position.x, y: b.body.position.y, z: b.body.position.z, r: Math.max(b.w, b.h) * 0.5 + 0.3, block: true });
  const list = [];
  const angles = [14, 24, 34, 44, 54, 64, 74].map(a => a * Math.PI / 180);
  const powers = [0.42, 0.55, 0.68, 0.8, 0.9, 1.0];
  const zs = [0, -0.5, 0.5];
  for (const a of angles) for (const f of powers) for (const zoff of zs) {
    const v = MAXV * f;
    const vx = Math.cos(a) * v, vy = Math.sin(a) * v, vz = zoff * 2.2;
    const pull = { x: -vx / C.LAUNCH_POWER, y: -vy / C.LAUNCH_POWER, z: -vz / C.LAUNCH_POWER };
    if (Math.hypot(pull.x, pull.y, pull.z) > C.MAX_PULL) continue;
    const hit = ballisticMinDist(pull, targets);
    if (hit.d < 1.0) list.push({ pull, quality: -hit.d, tHit: hit.t, hitBird: !!(hit.target && hit.target.bird) });
  }
  list.sort((a, b) => b.quality - a.quality || (b.hitBird - a.hitBird));
  return list.slice(0, 7);
}

function evalShot(sim, snap, pull, pigType, tHit) {
  const opts = {};
  if (pigType === 'speed') opts.boostAt = 0.35;
  if (pigType === 'bomb') opts.explodeAt = tHit != null ? Math.max(tHit - 0.05, 0.1) : 'onContact';
  const events = sim.shoot(pull, pigType, opts);
  let value = 0;
  for (const e of events) {
    if (e.type === 'birdKilled') value += C.SCORE_BIRD;
    if (e.type === 'blockDestroyed') value += C.MAT_SCORE[e.mat] || 100;
  }
  const result = { value, events, birdsLeft: sim.birdsAlive() };
  sim.restore(snap);
  return result;
}

// 求解一关：返回 { solved, shots, pigsUsed }
function solve(level, opts = {}) {
  const sim = new Sim(level);
  sim.preSim();
  const shots = [];
  for (let i = 0; i < level.pigTypes.length; i++) {
    if (sim.birdsAlive() === 0) break;
    const pigType = level.pigTypes[i];
    const snap = sim.snapshot();
    const cands = candidates(sim);
    let best = null;
    for (const cand of cands) {
      const r = evalShot(sim, snap, cand.pull, pigType, cand.tHit);
      if (!best || r.value > best.value || (r.value === best.value && r.birdsLeft < best.birdsLeft)) {
        best = { ...r, pull: cand.pull, pigType };
      }
    }
    // 没有候选也能打：补一个朝最近鸟的中等弹道
    if (!best) {
      const bird = sim.birds.find(b => b.alive);
      if (!bird) break;
      const pull = { x: -1.6, y: -1.2, z: 0 };
      const r = evalShot(sim, snap, pull, pigType, 1.2);
      best = { ...r, pull, pigType };
    }
    // 应用最优（真实执行，不回滚）
    const opts2 = {};
    if (pigType === 'speed') opts2.boostAt = 0.35;
    if (pigType === 'bomb') opts2.explodeAt = typeof best.events !== 'undefined' && best.pull ? 'onContact' : 'onContact';
    const ev = sim.shoot(best.pull, pigType, pigType === 'bomb' ? { explodeAt: 'onContact' } : opts2);
    shots.push({ pull: best.pull, pigType, events: ev.filter(e => e.type === 'birdKilled').length });
  }
  return { solved: sim.birdsAlive() === 0, shots, pigsUsed: shots.length, birdsLeft: sim.birdsAlive() };
}

module.exports = { solve };

if (require.main === module) {
  const { LEVELS } = require('../js/levels.js');
  const idx = parseInt(process.argv[2] || '0', 10);
  const lv = LEVELS[idx];
  console.log('关卡', lv.id, lv.name, '猪:', lv.pigTypes.join(','), '鸟:', lv.birds.length, '块:', lv.blocks.length);
  const t0 = Date.now();
  const r = solve(lv);
  console.log(`结果: ${r.solved ? '✅ 可通关' : '❌ 未解'} | 用猪 ${r.pigsUsed}/${lv.pigTypes.length} | 剩余鸟 ${r.birdsLeft} | ${Date.now() - t0}ms`);
}
