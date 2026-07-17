#!/usr/bin/env node
// 关卡生成器 — 5 张主题地图 × 20 关 = 100 关
// 模板 + 难度曲线 + 种子确定性；与 solver 联动自动修复（不可解则加猪/换种子）。
const CONFIG = require('../js/config.js');

// ========== 地图定义 ==========
const MAPS = [
  {
    id: 'grassland', name: '青青草原', icon: '🌿',
    theme: { sky: 0x87CEEB, fog: 0xA8D8EA, ground: 0x7CB342, mountain: 0x8E9EAB, ambient: 0xffffff, sun: 0xffffff, sunIntensity: 0.75, sunBall: 0xFFD54F },
    matWeights: { wood: 0.72, ice: 0.26, stone: 0.02 },
    hillsP: 0.05, tntP: 0.04, flyP: 0.25,
  },
  {
    id: 'desert', name: '沙漠遗迹', icon: '🏜️',
    theme: { sky: 0xF0C57C, fog: 0xEDD9A3, ground: 0xE0BE7E, mountain: 0xC2A878, ambient: 0xFFF3E0, sun: 0xFFE0B2, sunIntensity: 0.85, sunBall: 0xFFB74D },
    matWeights: { wood: 0.45, ice: 0.10, stone: 0.45 },
    hillsP: 0.4, tntP: 0.10, flyP: 0.3,
  },
  {
    id: 'snow', name: '雪山冰川', icon: '🏔️',
    theme: { sky: 0xB8D4E8, fog: 0xD6E6F2, ground: 0xEDF4FA, mountain: 0x9FB6C9, ambient: 0xF0F8FF, sun: 0xE3F2FD, sunIntensity: 0.7, sunBall: 0xFFF9C4 },
    matWeights: { wood: 0.35, ice: 0.55, stone: 0.10 },
    hillsP: 0.15, tntP: 0.10, flyP: 0.45,
  },
  {
    id: 'volcano', name: '火山熔岩', icon: '🌋',
    theme: { sky: 0x6D4C4C, fog: 0x7A5548, ground: 0x5D4037, mountain: 0x4E342E, ambient: 0xFFCCBC, sun: 0xFFAB91, sunIntensity: 0.65, sunBall: 0xFF7043 },
    matWeights: { wood: 0.28, ice: 0.07, stone: 0.65 },
    hillsP: 0.45, tntP: 0.22, flyP: 0.35,
  },
  {
    id: 'sky', name: '云端天空城', icon: '☁️',
    theme: { sky: 0x6EA8D8, fog: 0x9CC3E5, ground: 0xB7D3EA, mountain: 0xA7C4DC, ambient: 0xffffff, sun: 0xffffff, sunIntensity: 0.8, sunBall: 0xFFF59D },
    matWeights: { wood: 0.42, ice: 0.28, stone: 0.30 },
    hillsP: 0.0, tntP: 0.16, flyP: 0.55,
  },
];

// ========== 随机数 ==========
function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// ========== 结构模板（局部坐标：柱/梁/板，单位格 0.8）==========
// 每个模板返回 blocks 相对坐标列表 + perches（可站鸟平台: {x,y,w}）
const U = 0.8; // 基本块宽

function tplTower(rng, mat) { // 双柱单梁小塔
  const h1 = 1 + (rng() < 0.5 ? 1 : 0), blocks = [];
  for (let i = 0; i < h1; i++) {
    blocks.push({ dx: -0.9, dy: 0.5 + i * 1.0, w: U, h: 1, d: U, mat });
    blocks.push({ dx: 0.9, dy: 0.5 + i * 1.0, w: U, h: 1, d: U, mat });
  }
  const beamY = h1 + 0.02 + 0.2;
  blocks.push({ dx: 0, dy: beamY, w: 2.6, h: 0.4, d: U, mat });
  const perches = [{ dx: 0, dy: beamY + 0.2 + 0.4, w: 2.6 }];
  return { blocks, perches, topY: beamY + 0.2 };
}

function tplHouse(rng, mat, mat2) { // 四柱两梁小屋
  const blocks = [];
  [-1.3, -0.45, 0.45, 1.3].forEach(dx => blocks.push({ dx, dy: 0.5, w: U, h: 1, d: U, mat }));
  blocks.push({ dx: 0, dy: 1.22, w: 3.4, h: 0.4, d: U, mat });
  [-0.9, 0.9].forEach(dx => blocks.push({ dx, dy: 1.92, w: U, h: 1, d: U, mat: mat2 }));
  blocks.push({ dx: 0, dy: 2.64, w: 2.6, h: 0.4, d: U, mat: mat2 });
  // 小屋内部净宽不足（内柱间距0.9<鸟径0.8+余量），不放内部鸟
  const perches = [{ dx: 0, dy: 2.64 + 0.6, w: 2.6 }];
  return { blocks, perches, topY: 2.84 };
}

function tplBunker(rng, matHeavy, matLight) { // 石基木顶碉堡
  const blocks = [];
  [-0.9, 0.9].forEach(dx => {
    blocks.push({ dx, dy: 0.5, w: U, h: 1, d: U, mat: matHeavy });
    blocks.push({ dx, dy: 1.5, w: U, h: 1, d: U, mat: matHeavy });
  });
  blocks.push({ dx: 0, dy: 2.22, w: 2.6, h: 0.4, d: U, mat: matLight });
  blocks.push({ dx: 0, dy: 2.85, w: 1.2, h: 0.9, d: U, mat: matLight });
  const perches = [{ dx: 0, dy: 2.85 + 0.85, w: 1.2 }, { dx: 0, dy: 0.42, w: 1.0, inside: true }];
  return { blocks, perches, topY: 3.3 };
}

function tplBridge(rng, mat) { // 双塔长桥
  const blocks = [];
  [-2.2, 2.2].forEach(dx => {
    for (let i = 0; i < 2; i++) blocks.push({ dx, dy: 0.5 + i * 1.0, w: U, h: 1, d: U, mat });
  });
  blocks.push({ dx: 0, dy: 2.22, w: 5.6, h: 0.4, d: U, mat });
  const perches = [{ dx: -1.2, dy: 2.22 + 0.6, w: 1.4 }, { dx: 1.2, dy: 2.22 + 0.6, w: 1.4 }];
  return { blocks, perches, topY: 2.42, wide: true };
}

function tplPyramid(rng, mat) { // 金字塔堆叠
  const blocks = [];
  [-1.35, -0.45, 0.45, 1.35].forEach(dx => blocks.push({ dx, dy: 0.5, w: U, h: 1, d: U, mat }));
  [-0.9, 0, 0.9].forEach(dx => blocks.push({ dx, dy: 1.52, w: U, h: 1, d: U, mat }));
  blocks.push({ dx: 0, dy: 2.54, w: U, h: 1, d: U, mat });
  const perches = [{ dx: 0, dy: 2.54 + 0.9, w: U }];
  return { blocks, perches, topY: 3.04 };
}

function tplTNTNest(rng, mat) { // TNT 核心建筑
  const blocks = [];
  [-0.9, 0.9].forEach(dx => blocks.push({ dx, dy: 0.5, w: U, h: 1, d: U, mat }));
  blocks.push({ dx: 0, dy: 0.35, w: 0.7, h: 0.7, d: 0.7, mat: 'tnt' }); // h=0.7 → 中心贴地 0.35
  blocks.push({ dx: 0, dy: 1.22, w: 2.6, h: 0.4, d: U, mat });
  [-0.9, 0.9].forEach(dx => blocks.push({ dx, dy: 1.92, w: U, h: 1, d: U, mat }));
  blocks.push({ dx: 0, dy: 2.64, w: 2.6, h: 0.4, d: U, mat });
  const perches = [{ dx: 0, dy: 2.64 + 0.6, w: 2.6 }];
  return { blocks, perches, topY: 2.84 };
}

function tplWall(rng, mat) { // 高墙挡路
  const blocks = [];
  const rows = 2 + (rng() < 0.5 ? 1 : 0);
  for (let i = 0; i < rows; i++) blocks.push({ dx: 0, dy: 0.5 + i * 1.0, w: 0.7, h: 1, d: U, mat });
  const perches = [{ dx: 0, dy: rows + 0.4, w: 0.7 }];
  return { blocks, perches, topY: rows };
}

const TEMPLATES = [tplTower, tplHouse, tplBunker, tplBridge, tplPyramid, tplTNTNest, tplWall];

// ========== 单关生成 ==========
function pickMat(rng, w) {
  const r = rng();
  if (r < w.stone) return 'stone';
  if (r < w.stone + w.ice) return 'ice';
  return 'wood';
}

function genLevel(map, idxInMap, globalId, seed) {
  const rng = mulberry32(seed);
  const diff = idxInMap / 19; // 0..1 难度
  const blocks = [], birds = [], hills = [];

  // 结构数量与站位
  const nStruct = 1 + (diff > 0.25 ? 1 : 0) + (diff > 0.6 ? 1 : 0); // 1~3 组
  const zoneStart = 9.5, zoneEnd = 13 + nStruct * 5.5;
  let xs = [];
  if (nStruct === 1) xs = [zoneStart + rng() * 3];
  else if (nStruct === 2) xs = [zoneStart + rng() * 1.5, zoneStart + 5.5 + rng() * 2];
  else xs = [zoneStart + rng() * 1.2, zoneStart + 5 + rng() * 1.5, zoneStart + 10 + rng() * 2];

  const perchesAll = [];
  let allowTNT = (map.tntP > 0.05) && (idxInMap >= 3);
  // TNT 配额制：合格地图约半数关卡保底一个 TNT 巢（告别纯 RNG 摸奖）
  const wantTNT = allowTNT && (idxInMap % 2 === 1 || rng() < map.tntP);
  for (let s = 0; s < nStruct; s++) {
    // 选模板
    let pool = TEMPLATES.filter(t => {
      if (t === tplTNTNest) return allowTNT && rng() < map.tntP + 0.25;
      if (t === tplBunker) return map.matWeights.stone > 0.1;
      if (t === tplWall) return diff > 0.3;
      if (t === tplBridge) return diff > 0.15;
      return true;
    });
    let tpl = pool[Math.floor(rng() * pool.length)];
    if (wantTNT && s === nStruct - 1 && !blocks.some(b => b.type === 'tnt')) tpl = tplTNTNest;
    const mat = pickMat(rng, map.matWeights);
    const mat2 = pickMat(rng, map.matWeights);
    const heavy = 'stone', light = mat;
    const st = tpl(rng, mat, mat2 === mat ? (mat === 'wood' ? 'ice' : 'wood') : mat2, heavy, light);
    const bx = xs[s], bz = (rng() - 0.5) * 1.6;
    for (const b of st.blocks) {
      const type = b.mat === 'tnt' ? 'tnt' : b.mat;
      blocks.push({
        type,
        x: +(bx + b.dx).toFixed(2), y: +b.dy.toFixed(2), z: +(bz).toFixed(2),
        w: b.w, h: b.h, d: b.d,
      });
    }
    for (const p of st.perches) perchesAll.push({ x: bx + p.dx, y: p.dy, w: p.w, z: bz, inside: p.inside });
  }

  // 山坡（沙漠/火山）
  if (rng() < map.hillsP) {
    hills.push({ x: 6.5 + rng() * 2, y: 0, z: (rng() - 0.5) * 3, w: 1.8 + rng(), h: 1.2 + rng() * 0.8, d: 1.8 + rng() });
  }

  // 鸟数量与摆放
  const nBirds = Math.min(1 + Math.floor(diff * 4 + (idxInMap > 0 ? 1 : 0)), 5);
  const usedPerches = new Set();
  const openPerches = perchesAll.filter(p => !p.inside);
  for (let i = 0; i < nBirds; i++) {
    const flying = rng() < map.flyP;
    if (flying) {
      // 飞鸟只用开放平台上空，绝不从建筑内部出发
      const p = openPerches.length ? openPerches[Math.floor(rng() * openPerches.length)] : { x: xs[0], y: 3, z: 0 };
      birds.push({ type: 'flying', x: +p.x.toFixed(2), y: +(p.y + 1.6 + rng() * 0.8).toFixed(2), z: +(p.z || 0).toFixed(2), range: CONFIG.FLY_WANDER_RADIUS });
    } else {
      let pi = -1;
      for (let t = 0; t < 12; t++) {
        const cand = Math.floor(rng() * perchesAll.length);
        if (!usedPerches.has(cand)) { pi = cand; break; }
      }
      if (pi >= 0 && perchesAll.length) {
        usedPerches.add(pi);
        const p = perchesAll[pi];
        // 建筑内部的鸟活动范围收窄，避免跑动穿柱（AI 另有碰壁转身兜底）
        const range = p.inside ? Math.min(p.w / 2, 0.45) : Math.max(p.w / 2, 0.6);
        birds.push({ type: 'grounded', x: +p.x.toFixed(2), y: +p.y.toFixed(2), z: +(p.z || 0).toFixed(2), range: +range.toFixed(2) });
      } else {
        const p = openPerches.length ? openPerches[0] : { x: xs[0], y: 3, z: 0 };
        birds.push({ type: 'flying', x: +p.x.toFixed(2), y: +(p.y + 1.8).toFixed(2), z: +(p.z || 0).toFixed(2), range: CONFIG.FLY_WANDER_RADIUS });
      }
    }
  }

  // 猪配置
  const nBlocks = blocks.length;
  let pigs = Math.min(Math.max(nBirds + 1, nBirds + Math.ceil(nBlocks / 10)), 5);
  if (idxInMap === 0 && globalId === 1) pigs = 3; // 教学关
  const pigTypes = [];
  for (let i = 0; i < pigs; i++) {
    if (globalId === 1) { pigTypes.push('normal'); continue; }
    if (globalId === 2) { pigTypes.push(i === 0 ? 'speed' : 'normal'); continue; }
    let t = 'normal';
    const hasStone = blocks.some(b => b.type === 'stone') || map.matWeights.stone > 0.3;
    if (hasStone && i === pigs - 1 && idxInMap >= 5) t = 'bomb';
    else if (i === 0 && idxInMap >= 2 && rng() < 0.55) t = 'speed';
    else if (rng() < 0.18 && idxInMap >= 5) t = 'bomb';
    pigTypes.push(t);
  }
  // 保证石头多的关卡有炸弹猪
  const stoneCount = blocks.filter(b => b.type === 'stone').length;
  if (stoneCount >= 4 && !pigTypes.includes('bomb')) pigTypes[pigTypes.length - 1] = 'bomb';

  // 星级阈值
  const birdScore = nBirds * CONFIG.SCORE_BIRD;
  const blockScore = blocks.reduce((s, b) => s + CONFIG.MAT_SCORE[b.type], 0);
  const twoStar = Math.round((birdScore + blockScore * 0.28) / 100) * 100;
  const threeStar = Math.round((birdScore + blockScore * 0.52 + Math.max(0, pigs - 2) * CONFIG.SCORE_REMAINING_PIG * 0.5) / 100) * 100;

  return {
    id: globalId,
    map: map.id,
    name: `${map.name} ${idxInMap + 1}`,
    pigTypes,
    birds,
    blocks,
    hills,
    twoStar,
    threeStar: Math.max(threeStar, twoStar + 1500),
  };
}

// ========== 主流程 ==========
function generateAll(seedBase = 20260717) {
  const levels = [];
  let gid = 1;
  for (const map of MAPS) {
    for (let i = 0; i < 20; i++) {
      levels.push(genLevel(map, i, gid, seedBase + gid * 7919));
      gid++;
    }
  }
  return { MAPS, LEVELS: levels };
}

function emit(levels) {
  const header = `// 愤怒的猪 3D - 关卡数据 v3.0（由 tools/generate_levels.js 生成，请勿手改）
// 5 张主题地图 × 20 关 = 100 关；已经过无头物理验证与自动求解器校验。
const MAPS = ${JSON.stringify(MAPS, null, 2)};
const LEVELS = ${JSON.stringify(levels, null, 1)};
if (typeof module !== 'undefined' && module.exports) module.exports = { MAPS, LEVELS };
`;
  return header;
}

if (require.main === module) {
  const { LEVELS } = generateAll();
  require('fs').writeFileSync(require('path').join(__dirname, '../js/levels.js'), emit(LEVELS));
  console.log(`生成 ${LEVELS.length} 关`);
}
module.exports = { generateAll, genLevel, MAPS, emit };
