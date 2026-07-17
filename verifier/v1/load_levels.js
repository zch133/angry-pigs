// 共享关卡加载器（node 侧）：maps.js + 6 个分块 → { MAPS, LEVELS }
// 浏览器侧由 index.html 按序引入 chunk_0..5 后自动拼接 window.LEVELS。
const MAPS = require('../../js/maps.js');
const LEVELS = [];
for (let i = 0; i < 6; i++) LEVELS.push(...require(`../../js/levels/chunk_${i}.js`));
module.exports = { MAPS, LEVELS };
