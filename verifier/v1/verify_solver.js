#!/usr/bin/env node
// verify_solver.js — 可通关门：自动玩家证明每关可用给定猪全歼鸟（通过率须 100%）
// 用法: node verifier/v1/verify_solver.js [起始下标] [数量]  （仓库根目录）
const { solve } = require('../../tools/solver.js');
const { LEVELS } = require('../../js/levels.js');

const start = parseInt(process.argv[2] || '0', 10);
const count = parseInt(process.argv[3] || String(LEVELS.length), 10);
const subset = LEVELS.slice(start, start + count);

let fails = [], totalTime = 0, totalPigsUsed = 0, totalPigs = 0;
for (const lv of subset) {
  const t0 = Date.now();
  try {
    const r = solve(lv);
    totalTime += Date.now() - t0;
    totalPigsUsed += r.pigsUsed; totalPigs += lv.pigTypes.length;
    if (!r.solved) fails.push(`FAIL 关 ${lv.id} (${lv.name}) 未解 | 猪${lv.pigTypes.join(',')} 鸟${lv.birds.length} 剩${r.birdsLeft}`);
  } catch (e) {
    fails.push(`FAIL 关 ${lv.id} 异常: ${e.message}`);
  }
}
console.log('===== verify_solver v1 =====');
console.log(`通过 ${subset.length - fails.length}/${subset.length} | 平均用猪 ${(totalPigsUsed / subset.length).toFixed(2)}/${(totalPigs / subset.length).toFixed(2)} | 总耗时 ${(totalTime / 1000).toFixed(1)}s`);
fails.forEach(f => console.log(f));
console.log(`===== 结果: ${fails.length === 0 ? 'ALL PASS' : fails.length + ' FAIL'} =====`);
process.exit(fails.length === 0 ? 0 : 1);
