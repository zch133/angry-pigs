#!/usr/bin/env node
// verify_static.js — 静态门：文件齐备/语法/禁CDN/防侵权/关卡数量与分布/阈值 sanity
// 用法: node verifier/v1/verify_static.js  （在仓库根目录运行）
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '../..');
let failures = [];
let notes = [];
function ok(cond, msg) { (cond ? notes : failures).push((cond ? 'PASS ' : 'FAIL ') + msg); }

// ---------- 1. 关键文件齐备 ----------
const REQUIRED = ['index.html', 'css/style.css', 'js/config.js', 'js/levels.js', 'js/models.js', 'js/audio.js', 'js/game.js', 'standalone/three.min.js', 'standalone/cannon.min.js'];
for (const f of REQUIRED) ok(fs.existsSync(path.join(ROOT, f)), `文件存在: ${f}`);

// ---------- 2. JS 语法 ----------
for (const f of REQUIRED.filter(f => f.endsWith('.js') && !f.startsWith('standalone'))) {
  const p = path.join(ROOT, f);
  if (!fs.existsSync(p)) continue;
  try { execSync(`node --check "${p}"`, { stdio: 'pipe' }); ok(true, `语法通过: ${f}`); }
  catch (e) { ok(false, `语法失败: ${f} :: ${e.stderr?.toString().slice(0, 200)}`); }
}

// ---------- 3. index.html 不引用外链脚本/样式 ----------
const idxPath = path.join(ROOT, 'index.html');
if (fs.existsSync(idxPath)) {
  const html = fs.readFileSync(idxPath, 'utf8');
  const extRefs = [...html.matchAll(/<(?:script|link)[^>]+(?:src|href)\s*=\s*"https?:\/\/[^"]+"/gi)];
  ok(extRefs.length === 0, `index.html 无外链资源 (发现 ${extRefs.length} 处${extRefs.length ? ': ' + extRefs.map(m => m[0]).join(' | ') : ''})`);
  ok(/standalone\/three\.min\.js/.test(html), 'index.html 引用 vendored three.min.js');
  ok(/standalone\/cannon\.min\.js/.test(html), 'index.html 引用 vendored cannon.min.js');
}

// ---------- 4. 防侵权禁用词扫描（对玩家可见/分发的文件） ----------
const BANNED = [/angry\s*birds?/i, /angrybirds/i, /rovio/i, /bad\s*piggies/i, /\bred\s*(the\s*)?bird\b/i, /\bchuck\b/i, /\bmatilda\b/i, /\bterence\b/i, /\bstella\b/i, /\bbomb\s*bird\b/i, /\bmighty\s*eagle\b/i];
const SCAN_EXT = ['.html', '.js', '.css', '.md'];
const SCAN_DIRS = ['', 'js', 'css', 'docs', 'adr', 'standalone'];
let hits = [];
for (const d of SCAN_DIRS) {
  const dir = path.join(ROOT, d);
  if (!fs.existsSync(dir)) continue;
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    if (!fs.statSync(p).isFile() || !SCAN_EXT.includes(path.extname(f))) continue;
    if (f.endsWith('.min.js')) continue; // 第三方库本身不扫
    const txt = fs.readFileSync(p, 'utf8');
    for (const re of BANNED) if (re.test(txt)) hits.push(`${path.join(d, f)}: ${re}`);
  }
}
ok(hits.length === 0, `禁用词扫描 0 命中 (${hits.join('; ') || '干净'})`);

// ---------- 5. 关卡数量与分布 ----------
const lvPath = path.join(ROOT, 'js/levels.js');
if (fs.existsSync(lvPath)) {
  const sandbox = {};
  const code = fs.readFileSync(lvPath, 'utf8');
  try {
    const fn = new Function(code + '; return {LEVELS: typeof LEVELS!=="undefined"?LEVELS:null, MAPS: typeof MAPS!=="undefined"?MAPS:null};');
    const { LEVELS, MAPS } = fn.call(sandbox);
    ok(Array.isArray(LEVELS), 'LEVELS 数组可解析');
    ok(Array.isArray(MAPS), 'MAPS 数组可解析');
    if (Array.isArray(LEVELS) && Array.isArray(MAPS)) {
      ok(LEVELS.length >= 100, `总关卡数 >= 100 (实际 ${LEVELS.length})`);
      ok(MAPS.length === 5, `地图数 == 5 (实际 ${MAPS.length})`);
      for (const m of MAPS) {
        const cnt = LEVELS.filter(l => l.map === m.id).length;
        ok(cnt >= 20, `地图 ${m.id} 关卡 >= 20 (实际 ${cnt})`);
      }
      // schema + 阈值
      let schemaErr = [];
      for (const l of LEVELS) {
        if (!l.id || !l.map || !Array.isArray(l.pigTypes) || !l.pigTypes.length) schemaErr.push(`${l.id}: 缺 id/map/pigTypes`);
        if (!Array.isArray(l.birds) || !l.birds.length) schemaErr.push(`${l.id}: 无鸟`);
        if (!Array.isArray(l.blocks)) schemaErr.push(`${l.id}: blocks 非数组`);
        if (!(l.twoStar > 0 && l.threeStar > l.twoStar)) schemaErr.push(`${l.id}: 星级阈值异常 two=${l.twoStar} three=${l.threeStar}`);
        for (const p of l.pigTypes) if (!['normal', 'speed', 'bomb'].includes(p)) schemaErr.push(`${l.id}: 未知猪 ${p}`);
        for (const b of l.blocks) if (!['ice', 'wood', 'stone', 'tnt'].includes(b.type)) schemaErr.push(`${l.id}: 未知材质 ${b.type}`);
        for (const b of l.birds) if (!['flying', 'grounded'].includes(b.type)) schemaErr.push(`${l.id}: 未知鸟 ${b.type}`);
      }
      ok(schemaErr.length === 0, `关卡 schema 合法 (${schemaErr.slice(0, 5).join('; ') || '全部通过'}${schemaErr.length > 5 ? ` …共${schemaErr.length}条` : ''})`);
      // 地图主题齐备
      for (const m of MAPS) ok(m.name && m.icon && m.theme && m.theme.sky != null && m.theme.ground != null, `地图 ${m.id} 主题字段齐备`);
    }
  } catch (e) { ok(false, `levels.js 解析异常: ${e.message}`); }
}

// ---------- 输出 ----------
console.log('===== verify_static v1 =====');
for (const n of notes) console.log(n);
console.log('---------------------------');
for (const f of failures) console.log(f);
console.log(`===== 结果: ${failures.length === 0 ? 'ALL PASS' : failures.length + ' FAIL'} | pass=${notes.length} fail=${failures.length} =====`);
process.exit(failures.length === 0 ? 0 : 1);
