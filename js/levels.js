// 愤怒的猪 3D - 关卡数据（PRD v2.1 对齐）

const LEVELS = [
    // 关卡1：教学关，1只站鸟，简单结构
    {
        pigTypes: ['normal', 'normal', 'normal'],
        birds: [
            { type: 'grounded', x: 8, y: 1.9, z: 0, range: 30 }
        ],
        blocks: [
            { type: 'wood', x: 7, y: 0.5, z: 0, w: 0.8, h: 1, d: 0.8 },
            { type: 'wood', x: 9, y: 0.5, z: 0, w: 0.8, h: 1, d: 0.8 },
            { type: 'wood', x: 8, y: 1.2, z: 0, w: 2.4, h: 0.4, d: 0.8 },
        ],
        hills: [],
        twoStar: 8000,
        threeStar: 12000,
    },
    // 关卡2：2只鸟（飞鸟+站鸟），多层结构，含飞速猪
    {
        pigTypes: ['speed', 'normal', 'normal'],
        birds: [
            { type: 'flying', x: 9, y: 3.8, z: 0, range: 1.5 },
            { type: 'grounded', x: 10, y: 2.7, z: 0, range: 30 }
        ],
        blocks: [
            { type: 'wood', x: 8.5, y: 0.5, z: 0, w: 0.8, h: 1, d: 0.8 },
            { type: 'wood', x: 10.5, y: 0.5, z: 0, w: 0.8, h: 1, d: 0.8 },
            { type: 'wood', x: 9.5, y: 1.2, z: 0, w: 2.4, h: 0.4, d: 0.8 },
            { type: 'ice', x: 9, y: 1.8, z: 0, w: 0.5, h: 0.7, d: 0.5 },
            { type: 'ice', x: 10, y: 1.8, z: 0, w: 0.5, h: 0.7, d: 0.5 },
            { type: 'wood', x: 9.5, y: 2.4, z: 0, w: 2, h: 0.35, d: 0.8 },
        ],
        hills: [],
        twoStar: 20000,
        threeStar: 30000,
    },
    // 关卡3：3只鸟，混合结构，含山坡，需三种猪配合
    {
        pigTypes: ['normal', 'speed', 'bomb'],
        birds: [
            { type: 'flying', x: 10, y: 4.5, z: 0, range: 1.5 },
            { type: 'grounded', x: 11, y: 2.7, z: 0.5, range: 30 },
            { type: 'grounded', x: 9, y: 1.9, z: 0.5, range: 30 },
        ],
        blocks: [
            // 左侧冰块堡垒
            { type: 'ice', x: 8, y: 0.5, z: 0.5, w: 0.6, h: 1, d: 0.6 },
            { type: 'ice', x: 8, y: 1.5, z: 0.5, w: 0.6, h: 1, d: 0.6 },
            // 中间木箱结构
            { type: 'wood', x: 9.5, y: 0.5, z: 0.5, w: 0.7, h: 1, d: 0.7 },
            { type: 'wood', x: 11, y: 0.5, z: 0.5, w: 0.7, h: 1, d: 0.7 },
            { type: 'wood', x: 10.2, y: 1.2, z: 0.5, w: 2.2, h: 0.4, d: 0.7 },
            { type: 'ice', x: 9.7, y: 1.8, z: 0.5, w: 0.5, h: 0.7, d: 0.5 },
            { type: 'ice', x: 10.8, y: 1.8, z: 0.5, w: 0.5, h: 0.7, d: 0.5 },
            { type: 'wood', x: 10.2, y: 2.4, z: 0.5, w: 2, h: 0.35, d: 0.7 },
            // 右侧石墙
            { type: 'stone', x: 12, y: 0.5, z: 0, w: 0.8, h: 1, d: 0.8 },
            { type: 'stone', x: 12, y: 1.5, z: 0, w: 0.8, h: 1, d: 0.8 },
            { type: 'wood', x: 12, y: 2.2, z: 0, w: 1.2, h: 0.4, d: 0.8 },
        ],
        // 山坡：静态物理碰撞体，挡住直射路线
        hills: [
            { x: 7, y: 0, z: -2, w: 2, h: 1.5, d: 1.5 },
        ],
        twoStar: 35000,
        threeStar: 50000,
    },
];

if (typeof module !== 'undefined') module.exports = LEVELS;
