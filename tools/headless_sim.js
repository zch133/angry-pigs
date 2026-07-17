// 无头物理仿真 — 在 Node 中用 cannon.js 复现游戏物理与伤害规则（数值全部来自 js/config.js）
// 供关卡验证（稳定性）与自动求解器（可通关性）使用。
const CANNON = require('../standalone/cannon.min.js');
const CONFIG = require('../js/config.js');
const C = CONFIG;

function createWorld() {
  const world = new CANNON.World();
  world.gravity.set(0, C.GRAVITY, 0);
  world.broadphase = new CANNON.NaiveBroadphase();
  world.solver.iterations = C.SOLVER_ITERATIONS;
  world.allowSleep = true;
  const mats = {
    ground: new CANNON.Material('ground'),
    pig: new CANNON.Material('pig'),
    ice: new CANNON.Material('ice'),
    wood: new CANNON.Material('wood'),
    stone: new CANNON.Material('stone'),
    tnt: new CANNON.Material('tnt'),
  };
  const cm = (a, b, f, r) => world.addContactMaterial(new CANNON.ContactMaterial(a, b, { friction: f, restitution: r }));
  world.defaultContactMaterial.friction = 0.45;
  world.defaultContactMaterial.restitution = 0.12;
  cm(mats.ground, mats.ice, 0.03, 0.05);
  cm(mats.ice, mats.ice, 0.02, 0.05);
  cm(mats.ground, mats.pig, 0.5, 0.35);
  cm(mats.pig, mats.ice, 0.05, 0.2);
  cm(mats.pig, mats.wood, 0.4, 0.25);
  cm(mats.pig, mats.stone, 0.5, 0.2);
  const ground = new CANNON.Body({ mass: 0, material: mats.ground, shape: new CANNON.Plane() });
  ground.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
  world.addBody(ground);
  return { world, mats, ground };
}

// ========== 关卡实例 ==========
class Sim {
  constructor(level) {
    const { world, mats, ground } = createWorld();
    this.world = world; this.mats = mats; this.ground = ground;
    this.level = level;
    this.blocks = []; this.birds = []; this.hills = [];
    this.pendingChain = [];
    this.events = []; // {type:'blockDestroyed'|'birdKilled', ...}
    this._removals = []; // 延迟移除（cannon 0.6.2 禁止在 step/collide 回调中直接 removeBody）
    level.blocks.forEach(bd => this.spawnBlock(bd));
    (level.hills || []).forEach(hd => {
      const r = Math.min(hd.w, hd.h) * 0.95;
      const body = new CANNON.Body({ mass: 0, shape: new CANNON.Sphere(r), position: new CANNON.Vec3(hd.x, hd.y || 0, hd.z) });
      this.world.addBody(body);
      this.hills.push(body);
    });
    level.birds.forEach(bd => {
      this.birds.push({ x: bd.x, y: bd.y, z: bd.z, kind: bd.type, range: bd.range || 1.2, alive: true, body: null });
    });
  }

  spawnBlock(bd) {
    const body = new CANNON.Body({
      mass: C.MAT_DENSITY[bd.type] * bd.w * bd.h * bd.d,
      material: this.mats[bd.type === 'tnt' ? 'tnt' : bd.type],
      shape: new CANNON.Box(new CANNON.Vec3(bd.w / 2, bd.h / 2, bd.d / 2)),
      position: new CANNON.Vec3(bd.x, bd.y, bd.z),
    });
    if (bd.rotY) body.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), bd.rotY);
    body.allowSleep = true; body.sleepSpeedLimit = 0.3; body.sleepTimeLimit = 0.45;
    const block = { body, type: bd.type, w: bd.w, h: bd.h, d: bd.d, hp: C.MAT_HP[bd.type], maxHp: C.MAT_HP[bd.type], lastHitAt: 0, dead: false, spawn: { x: bd.x, y: bd.y, z: bd.z, rotY: bd.rotY || 0 } };
    body.userData = { kind: 'block', ref: block };
    body.addEventListener('collide', e => this.onBlockCollide(block, e));
    this.world.addBody(body);
    this.blocks.push(block);
  }

  // 与 game.js 相同规则
  onBlockCollide(block, e) {
    if (block.dead || !this.armed) return;
    const now = this.timeMs || 0;
    if (now - block.lastHitAt < C.HIT_COOLDOWN_MS) return;
    const speed = Math.abs(e.contact.getImpactVelocityAlongNormal());
    if (speed < 1.2) return;
    block.lastHitAt = now;
    if ((block.type === 'ice' && speed > C.SPEED_BREAK_ICE) || (block.type === 'wood' && speed > C.SPEED_BREAK_WOOD)) {
      this.destroyBlock(block);
      return;
    }
    this.damageBlock(block, 1);
  }

  damageBlock(block, dmg) {
    if (block.dead) return;
    block.hp -= dmg;
    if (block.hp <= 0) this.destroyBlock(block);
  }

  destroyBlock(block) {
    if (block.dead) return;
    block.dead = true;
    const p = block.body ? { x: block.body.position.x, y: block.body.position.y, z: block.body.position.z } : { x: block.spawn.x, y: block.spawn.y, z: block.spawn.z };
    if (block.body) { this._removals.push(block.body); block.body = null; }
    this.events.push({ type: 'blockDestroyed', mat: block.type });
    if (block.type === 'tnt') this.pendingChain.push({ x: p.x, y: p.y, z: p.z, t: C.TNT_CHAIN_DELAY_MS / 1000 });
  }

  flushRemovals() {
    for (const b of this._removals) this.world.removeBody(b);
    this._removals.length = 0;
  }

  explode(x, y, z) {
    const R = C.EXPLOSION_RADIUS;
    for (const block of [...this.blocks]) {
      if (block.dead || !block.body) continue;
      const p = block.body.position;
      const d = Math.hypot(p.x - x, p.y - y, p.z - z);
      if (d > R + 0.5) continue;
      const dmg = Math.max(1, Math.round(C.EXPLOSION_DAMAGE_CENTER - (d / R) * (C.EXPLOSION_DAMAGE_CENTER - 1)));
      const dir = { x: p.x - x, y: p.y - y, z: p.z - z };
      const len = Math.hypot(dir.x, dir.y, dir.z) || 1;
      const k = C.EXPLOSION_IMPULSE * (1 - d / (R + 1)) * 0.6;
      block.body.wakeUp();
      block.body.velocity.x += dir.x / len * k;
      block.body.velocity.y += (dir.y / len + 0.6) * k;
      block.body.velocity.z += dir.z / len * k;
      this.damageBlock(block, dmg);
    }
    for (const bird of this.birds) {
      if (!bird.alive) continue;
      const d = Math.hypot(bird.x - x, bird.y - y, bird.z - z);
      if (d <= R + C.BIRD_RADIUS) this.killBird(bird);
    }
  }

  killBird(bird) {
    if (!bird.alive) return;
    bird.alive = false;
    this.events.push({ type: 'birdKilled' });
  }

  preSim(seconds = C.PRE_SIM_SECONDS) {
    this.armed = false;
    const steps = Math.round(seconds * 60);
    for (let i = 0; i < steps; i++) { this.timeMs = (this.timeMs || 0) + C.FIXED_DT * 1000; this.world.step(C.FIXED_DT); }
    for (const b of this.blocks) if (b.body) { b.body.velocity.setZero(); b.body.angularVelocity.setZero(); b.body.sleep(); }
    this.armed = true; // 沉降完成，伤害系统上膛
  }

  // 稳定性检测：预演算后结构位移
  checkStability() {
    let maxDisp = 0;
    for (const b of this.blocks) {
      if (b.dead || !b.body) continue;
      const lv = this.level.blocks[this.blocks.indexOf(b)];
      const d = Math.hypot(b.body.position.x - lv.x, b.body.position.y - lv.y, b.body.position.z - lv.z);
      maxDisp = Math.max(maxDisp, d);
      if (!isFinite(b.body.position.x + b.body.position.y + b.body.position.z)) return { ok: false, reason: 'NaN', maxDisp };
      if (b.body.position.y < -0.5) return { ok: false, reason: 'fall-through', maxDisp };
    }
    return { ok: maxDisp < 0.15, maxDisp, reason: maxDisp < 0.15 ? '' : 'unstable' };
  }

  // 球(猪/鸟)与有向盒重叠
  sphereHitsBlock(center, r, block) {
    const p = block.body.position;
    const q = block.body.quaternion;
    const inv = q.conjugate();
    const v = new CANNON.Vec3(center.x - p.x, center.y - p.y, center.z - p.z);
    inv.vmult(v, v);
    const cx = Math.max(-block.w / 2, Math.min(block.w / 2, v.x));
    const cy = Math.max(-block.h / 2, Math.min(block.h / 2, v.y));
    const cz = Math.max(-block.d / 2, Math.min(block.d / 2, v.z));
    return (v.x - cx) ** 2 + (v.y - cy) ** 2 + (v.z - cz) ** 2 < r * r;
  }

  // 发射一只猪并模拟完整回合
  // pull: {x,y,z}（拖拽偏移，发射速度 = -pull*LAUNCH_POWER）
  // opts: {boostAt: 秒后加速(飞速猪), explodeAt: 秒后爆炸(炸弹猪) 或 'onContact'}
  shoot(pull, pigType = 'normal', opts = {}) {
    const body = new CANNON.Body({
      mass: 2, material: this.mats.pig,
      shape: new CANNON.Sphere(C.PIG_RADIUS),
      position: new CANNON.Vec3(C.SLINGSHOT_POS.x, C.SLINGSHOT_POS.y, C.SLINGSHOT_POS.z),
    });
    body.velocity.set(-pull.x * C.LAUNCH_POWER, -pull.y * C.LAUNCH_POWER, -pull.z * C.LAUNCH_POWER);
    body.angularDamping = 0.3; body.linearDamping = 0.01;
    body.allowSleep = false;
    let contacted = false, exploded = false, boosted = false;
    body.addEventListener('collide', () => {
      contacted = true;
      if (pigType === 'bomb' && opts.explodeAt === 'onContact' && !exploded) {
        exploded = true;
        const px = body.position.x, py = body.position.y, pz = body.position.z;
        this.explode(px, py, pz);
        this._removals.push(body); body.__gone = true;
      }
    });
    this.world.addBody(body);

    const maxT = opts.maxT || 7;
    let t = 0, stopT = 0;
    const dt = C.FIXED_DT;
    while (t < maxT) {
      t += dt; this.timeMs = (this.timeMs || 0) + dt * 1000;
      if (body.__gone) { this.stepWorldOnly(dt); continue; }
      // 技能触发
      if (pigType === 'speed' && !boosted && opts.boostAt != null && t >= opts.boostAt && !contacted) {
        boosted = true; body.velocity.scale(C.SPEED_BOOST_MULT, body.velocity);
      }
      if (pigType === 'bomb' && !exploded && typeof opts.explodeAt === 'number' && t >= opts.explodeAt) {
        exploded = true;
        const p = body.position;
        this.explode(p.x, p.y, p.z);
        this.world.removeBody(body); body.__gone = true;
        continue;
      }
      this.stepWorldOnly(dt, body);
      if (body.__gone) continue;
      const p = body.position;
      // 滚动阻力（与 game.js 一致）
      const spd = body.velocity.norm();
      if (p.y < C.PIG_RADIUS + 0.08 && spd < 5) {
        const damp = Math.max(0, 1 - 4.5 * dt);
        body.velocity.scale(damp, body.velocity);
        body.angularVelocity.scale(Math.max(0, 1 - 6 * dt), body.angularVelocity);
        if (spd < 0.4) { body.velocity.set(0, 0, 0); body.angularVelocity.set(0, 0, 0); }
      }
      // 猪撞鸟
      for (const bird of this.birds) {
        if (!bird.alive) continue;
        if (Math.hypot(p.x - bird.x, p.y - bird.y, p.z - bird.z) < C.PIG_RADIUS + C.BIRD_RADIUS + 0.06) this.killBird(bird);
      }
      // 出界
      if (p.x > C.OUT_X_MAX || p.x < C.OUT_X_MIN || p.y < C.OUT_Y_MIN) break;
      // 停止
      if (body.velocity.norm() < C.PIG_STOP_SPEED) {
        stopT += dt;
        if (stopT > C.PIG_STOP_TIME_MS / 1000) break;
      } else stopT = 0;
    }
    if (!body.__gone) this.world.removeBody(body);
    // 余波：让块继续滚 1 秒，处理二次砸鸟
    this.settleBirdsUnderBlocks(1.2);
    return this.events.splice(0);
  }

  stepWorldOnly(dt, pigBody = null) {
    this.world.step(dt);
    this.flushRemovals();
    // TNT 链爆
    for (let i = this.pendingChain.length - 1; i >= 0; i--) {
      const c = this.pendingChain[i];
      c.t -= dt;
      if (c.t <= 0) { this.pendingChain.splice(i, 1); this.explode(c.x, c.y, c.z); }
    }
    // 移动块砸鸟
    for (const bird of this.birds) {
      if (!bird.alive) continue;
      for (const b of this.blocks) {
        if (b.dead || !b.body || b.body.sleepState === 2) continue;
        if (b.body.velocity.norm() < C.BIRD_KILL_SPEED) continue;
        if (this.sphereHitsBlock(bird, C.BIRD_RADIUS + 0.08, b)) { this.killBird(bird); break; }
      }
    }
  }

  settleBirdsUnderBlocks(seconds) {
    const steps = Math.round(seconds * 60);
    for (let i = 0; i < steps; i++) { this.timeMs = (this.timeMs || 0) + C.FIXED_DT * 1000; this.stepWorldOnly(C.FIXED_DT); }
  }

  birdsAlive() { return this.birds.filter(b => b.alive).length; }
  blocksAlive() { return this.blocks.filter(b => !b.dead).length; }

  // 快照/恢复（求解器回溯用）
  snapshot() {
    return {
      blocks: this.blocks.map(b => ({
        dead: b.dead, hp: b.hp,
        p: b.body ? [b.body.position.x, b.body.position.y, b.body.position.z] : null,
        q: b.body ? [b.body.quaternion.x, b.body.quaternion.y, b.body.quaternion.z, b.body.quaternion.w] : null,
        v: b.body ? [b.body.velocity.x, b.body.velocity.y, b.body.velocity.z] : null,
        av: b.body ? [b.body.angularVelocity.x, b.body.angularVelocity.y, b.body.angularVelocity.z] : null,
        sleep: b.body ? b.body.sleepState : 0,
      })),
      birds: this.birds.map(b => b.alive),
      timeMs: this.timeMs,
    };
  }

  restore(snap) {
    this.events = [];
    this.pendingChain = [];
    this.timeMs = snap.timeMs;
    this.blocks.forEach((b, i) => {
      const s = snap.blocks[i];
      if (s.dead) {
        if (!b.dead) { b.dead = true; if (b.body) { this.world.removeBody(b.body); b.body = null; } }
        b.hp = s.hp;
        return;
      }
      if (b.dead || !b.body) {
        b.dead = false;
        const body = new CANNON.Body({
          mass: C.MAT_DENSITY[b.type] * b.w * b.h * b.d,
          material: this.mats[b.type === 'tnt' ? 'tnt' : b.type],
          shape: new CANNON.Box(new CANNON.Vec3(b.w / 2, b.h / 2, b.d / 2)),
          position: new CANNON.Vec3(s.p[0], s.p[1], s.p[2]),
        });
        body.allowSleep = true; body.sleepSpeedLimit = 0.3; body.sleepTimeLimit = 0.45;
        body.userData = { kind: 'block', ref: b };
        body.addEventListener('collide', e => this.onBlockCollide(b, e));
        this.world.addBody(body);
        b.body = body;
      }
      b.hp = s.hp;
      b.body.position.set(s.p[0], s.p[1], s.p[2]);
      b.body.quaternion.set(s.q[0], s.q[1], s.q[2], s.q[3]);
      b.body.velocity.set(s.v[0], s.v[1], s.v[2]);
      b.body.angularVelocity.set(s.av[0], s.av[1], s.av[2]);
      b.body.sleepState = s.sleep;
      b.lastHitAt = 0;
    });
    this.birds.forEach((b, i) => { b.alive = snap.birds[i]; });
  }
}

module.exports = { Sim, CANNON, C };
