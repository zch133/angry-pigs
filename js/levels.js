// 愤怒的猪 3D - 关卡数据 (PRD v2.1)
const LEVELS = [
  {
    name: '第一关：初识弹弓',
    pigTypes: ['normal', 'normal', 'normal'],
    birds: [{ type: 'grounded', x: 8, y: 1.9, z: 0, range: 1.2 }], // 平台宽2.4, 活动范围=1.2
    blocks: [
      { type: 'wood', x: 7, y: 0.5, z: 0, w: 0.8, h: 1, d: 0.8 },
      { type: 'wood', x: 9, y: 0.5, z: 0, w: 0.8, h: 1, d: 0.8 },
      { type: 'wood', x: 8, y: 1.2, z: 0, w: 2.4, h: 0.4, d: 0.8 },
    ],
    hills: [],
    twoStar: 8000,
    threeStar: 12000,
  },
  {
    name: '第二关：飞鸟与木箱',
    pigTypes: ['speed', 'normal', 'normal'],
    birds: [
      { type: 'flying', x: 9, y: 3.8, z: 0, range: 1.5 },
      { type: 'grounded', x: 10, y: 2.7, z: 0, range: 1.1 }, // 平台宽2.2, 活动范围=1.1
    ],
    blocks: [
      { type: 'wood', x: 8.5, y: 0.5, z: 0, w: 0.8, h: 1, d: 0.8 },
      { type: 'wood', x: 10.5, y: 0.5, z: 0, w: 0.8, h: 1, d: 0.8 },
      { type: 'wood', x: 9.5, y: 1.2, z: 0, w: 2.4, h: 0.4, d: 0.8 },
      { type: 'ice', x: 9.2, y: 1.8, z: 0, w: 0.5, h: 0.7, d: 0.5 },
      { type: 'ice', x: 10, y: 1.8, z: 0, w: 0.5, h: 0.7, d: 0.5 },
      { type: 'wood', x: 9.6, y: 2.3, z: 0, w: 1.8, h: 0.35, d: 0.8 },
    ],
    hills: [],
    twoStar: 20000,
    threeStar: 30000,
  },
  {
    name: '第三关：石墙与山坡',
    pigTypes: ['normal', 'speed', 'bomb'],
    birds: [
      { type: 'flying', x: 9, y: 4.2, z: 0, range: 1.5 },
      { type: 'grounded', x: 11, y: 1.9, z: 0.5, range: 1.0 },
      { type: 'grounded', x: 12, y: 2.7, z: 0, range: 0.9 },
    ],
    blocks: [
      { type: 'ice', x: 8, y: 0.5, z: 0, w: 0.6, h: 1, d: 0.6 },
      { type: 'ice', x: 9, y: 0.5, z: 0, w: 0.6, h: 1, d: 0.6 },
      { type: 'wood', x: 8.5, y: 1.2, z: 0, w: 1.6, h: 0.4, d: 0.6 },
      { type: 'wood', x: 9.5, y: 0.5, z: 0.5, w: 0.7, h: 1, d: 0.7 },
      { type: 'wood', x: 11, y: 0.5, z: 0.5, w: 0.7, h: 1, d: 0.7 },
      { type: 'wood', x: 10.2, y: 1.2, z: 0.5, w: 2.2, h: 0.4, d: 0.7 },
      { type: 'ice', x: 9.7, y: 1.8, z: 0.5, w: 0.5, h: 0.7, d: 0.5 },
      { type: 'ice', x: 10.8, y: 1.8, z: 0.5, w: 0.5, h: 0.7, d: 0.5 },
      { type: 'wood', x: 10.2, y: 2.4, z: 0.5, w: 2, h: 0.35, d: 0.7 },
      { type: 'stone', x: 12, y: 0.5, z: 0, w: 0.8, h: 1, d: 0.8 },
      { type: 'stone', x: 12, y: 1.5, z: 0, w: 0.8, h: 1, d: 0.8 },
    ],
    hills: [{ x: 7, y: 0, z: -2, w: 2, h: 1.5, d: 1.5 }],
    twoStar: 35000,
    threeStar: 50000,
  },
];
