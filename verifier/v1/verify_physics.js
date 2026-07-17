#!/usr/bin/env node
// verify_physics.js — 物理门：每关预演算后结构稳定、无 NaN、无穿透、鸟不与建筑穿插
// 用法: node verifier/v1/verify_physics.js （仓库根目录）
const path = require('path');
const { Sim, C } = require('../../tools/headless_sim.js');
const { LEVELS, MAPS } = require('../../js/levels.js');

let fails = [], notes = [];
const ok = (cond, msg) => (cond ? notes : fails).push((cond ? 'PASS ' : 'FAIL ') + msg);

ok(Array.isArray(LEVELS) && LEVELS.length >= 100, `关卡总数 >=100 (${LEVELS.length})`);
ok(Array.isArray(MAPS) && MAPS.length === 5, `地图数 ==5 (${MAPS && MAPS.length})`);

let worstDisp = 0, worstId = 0;
const t0 = Date.now();
for (const lv of LEVELS) {
  const sim = new Sim(lv);
  // 鸟与建筑初始穿插检查（生成态）
  let interpen = false;
  for (const bird of lv.birds) {
    for (const b of lv.blocks) {
      const dx = Math.abs(bird.x - b.x) - (b.w / 2 + C.BIRD_RADIUS * 0.8);
      const dy = Math.abs(bird.y - b.y) - (b.h / 2 + C.BIRD_RADIUS * 0.8);
      const dz = Math.abs(bird.z - b.z) - (b.d / 2 + C.BIRD_RADIUS * 0.8);
      if (dx < 0 && dy < 0 && dz < 0) interpen = true;
    }
  }
  // 站鸟必须有支撑：站在块顶或站在地面（建筑内部地面）
  let floating = false;
  for (const bird of lv.birds) {
    if (bird.type !== 'grounded') continue;
    const onGround = Math.abs(bird.y - C.BIRD_RADIUS) < 0.15;
    const onBlock = lv.blocks.some(b => Math.abs(bird.x - b.x) < b.w / 2 + 0.5 && Math.abs(bird.y - (b.y + b.h / 2 + C.BIRD_RADIUS - 0.1)) < 0.55);
    if (!onGround && !onBlock) floating = true;
  }
  sim.preSim();
  const st = sim.checkStability();
  if (st.maxDisp > worstDisp) { worstDisp = st.maxDisp; worstId = lv.id; }
  if (!st.ok) { fails.push(`FAIL 关 ${lv.id} 稳定性: ${st.reason} maxDisp=${st.maxDisp.toFixed(3)}`); continue; }
  if (interpen) { fails.push(`FAIL 关 ${lv.id} 鸟与建筑初始穿插`); continue; }
  if (floating) { fails.push(`FAIL 关 ${lv.id} 站鸟悬空`); continue; }
}
ok(fails.length === 0, `100 关稳定性/穿插/支撑检查 (最大位移 ${worstDisp.toFixed(3)} @关${worstId}, 阈值0.15)`);

console.log('===== verify_physics v1 =====');
notes.forEach(n => console.log(n));
console.log('----------------------------');
fails.forEach(f => console.log(f));
console.log(`===== 结果: ${fails.length === 0 ? 'ALL PASS' : fails.length + ' FAIL'} | ${Date.now() - t0}ms =====`);
process.exit(fails.length === 0 ? 0 : 1);
