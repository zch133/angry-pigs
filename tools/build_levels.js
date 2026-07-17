#!/usr/bin/env node
// 关卡生产线：生成 → 稳定性验证 → 求解器验证 → 自动修复（加猪/换种子）→ 输出 js/levels.js
const fs = require('fs');
const path = require('path');
const { genLevel, MAPS, emit } = require('./generate_levels.js');
const { Sim } = require('./headless_sim.js');
const { solve } = require('./solver.js');

const SEED_BASE = 20260717;
const MAX_PIGS = 6;

function checkStable(level) {
  const sim = new Sim(level);
  // 记录初始位置
  const init = level.blocks.map(b => ({ x: b.x, y: b.y, z: b.z }));
  sim.preSim();
  let maxDisp = 0, bad = '';
  sim.blocks.forEach((b, i) => {
    if (b.dead || !b.body) { bad = bad || 'collapsed:' + i; return; }
    const p = b.body.position;
    if (!isFinite(p.x + p.y + p.z)) bad = bad || 'nan:' + i;
    if (p.y < -0.5) bad = bad || 'fall:' + i;
    maxDisp = Math.max(maxDisp, Math.hypot(p.x - init[i].x, p.y - init[i].y, p.z - init[i].z));
  });
  return { ok: !bad && maxDisp < 0.15, maxDisp, bad };
}

function buildOne(map, idxInMap, globalId) {
  let seed = SEED_BASE + globalId * 7919;
  let level = null, stable = null, result = null;
  for (let attempt = 0; attempt < 40; attempt++) {
    level = genLevel(map, idxInMap, globalId, seed);
    stable = checkStable(level);
    if (!stable.ok) { seed += 101; continue; }
    result = solve(level);
    if (result.solved) return { level, meta: { attempt, addedPigs: 0, seedShift: seed - (SEED_BASE + globalId * 7919) } };
    // 修复策略 A：加猪（普通猪，最多到 MAX_PIGS）
    for (let extra = 1; extra <= MAX_PIGS - level.pigTypes.length; extra++) {
      const lv2 = JSON.parse(JSON.stringify(level));
      for (let k = 0; k < extra; k++) lv2.pigTypes.push('normal');
      // 加猪后剩余猪奖励变多，三星阈值相应上调
      lv2.threeStar += extra * 5000;
      const r2 = solve(lv2);
      if (r2.solved) return { level: lv2, meta: { attempt, addedPigs: extra, seedShift: seed - (SEED_BASE + globalId * 7919) } };
    }
    seed += 101; // 换种子重来
  }
  return { level: null, meta: { failed: true, stable, result } };
}

function main() {
  const t0 = Date.now();
  const out = [];
  const report = [];
  let gid = 1;
  for (const map of MAPS) {
    for (let i = 0; i < 20; i++) {
      const { level, meta } = buildOne(map, i, gid);
      if (!level) {
        console.error(`❌ 关卡 ${gid} (${map.id} ${i + 1}) 构建失败`, JSON.stringify(meta).slice(0, 300));
        report.push({ id: gid, map: map.id, ok: false, meta });
      } else {
        out.push(level);
        report.push({ id: gid, map: map.id, ok: true, pigs: level.pigTypes.length, birds: level.birds.length, blocks: level.blocks.length, ...meta });
        if (report.length % 10 === 0) console.log(`…${report.length}/100 关 (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
      }
      gid++;
    }
  }
  fs.writeFileSync(path.join(__dirname, '../js/levels.js'), emit(out));
  fs.writeFileSync(path.join(__dirname, 'build_report.json'), JSON.stringify(report, null, 1));
  const fails = report.filter(r => !r.ok).length;
  const repaired = report.filter(r => r.ok && (r.addedPigs > 0 || r.seedShift > 0)).length;
  console.log(`✅ 完成: ${out.length} 关 | 失败 ${fails} | 自动修复 ${repaired} | 用时 ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  process.exit(fails ? 1 : 0);
}

if (require.main === module) main();
