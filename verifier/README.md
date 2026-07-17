# Verifier 索引（append-only）

本目录存放验收标准与验证脚本。每次运行验证，须在 `verifier/runs/` 追加一条带时间戳的记录（命令、退出码、关键数值）。

## 版本记录

### v1 — 2026-07-17
- 位置：`verifier/v1/`
- 测量内容：
  1. 静态门（verify_static.js）：文件齐备、JS 语法、index.html 仅引用本地 vendored 库（禁 CDN）、防侵权禁用词扫描、关卡总数 ≥100、5 张地图且每张 ≥20 关、关卡 schema 与星级阈值 sanity
  2. 物理门（verify_physics.js，Stage 3 起生效）：Node 无头加载 cannon + 关卡数据 + 游戏物理配置；每关 2 秒预演算后结构稳定（位移/穿透/NaN 检查）、鸟不与建筑初始穿插
  3. 可通关门（verify_solver.js，Stage 3 起生效）：自动玩家对每关做有界弹道搜索，证明给定猪数可全歼鸟；通过率须 100%
- 与前版差异：首版
