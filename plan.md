# plan.md — 愤怒的猪 3D 完成计划（Orchestrator 执行蓝图）

> 目标：把 zch133/angry-pigs 做成可发布的成品。仿原版愤怒的小鸟手感（弹弓抛射+物理破坏），角色互换（猪打鸟），3D 画面，5 张地图 × ≥20 关 = ≥100 关，按真实游戏公司流程交付，零侵权风险，最终部署到 https://zch133.github.io/angry-pigs/ 供验收。

## 现状评估（已完成侦察）
- 仓库已有半成品：PRD v2.1（3 关设计）、index.html、js/{game,levels,models,audio}.js、vendored three@r128 + cannon@0.6.2（均在 Node 可加载 → 可无头验证）
- progress.md 显示重写中断；只有 3 关；index.html 引 CDN（有失效风险）
- 用户允许重做 → 决策：v3.0 结构化重写，复用已验证的数值体系与建模思路，保留 vendored 库（Node/浏览器行为一致，可离线验证）

## 关键决策
1. **技术栈**：Three.js r128（vendored）+ cannon.js 0.6.2（vendored）+ 原生 JS。不引 CDN，GitHub Pages 纯静态。
2. **玩法手感对齐原版**：拖拽弹弓+轨迹预测点、相机跟随/震屏、命中慢动作、材质分级破坏、连击倍率、碎片粒子、飘分、剩余猪奖励、三星评级。
3. **关卡生产管线**（游戏公司做法）：Node 关卡生成器（种子确定性、模板+难度曲线）→ 无头物理验证（稳定性/不穿插）→ 自动求解器证明可通关（不通过则自动修复/换种子）→ 产出 js/levels.js。
4. **防侵权**：全程序化原创美术/音效；禁用词扫描（原版英文名/厂商名/原版角色名）；猪≠绿色（粉/黄/黑），鸟≠红色（绿/橙）；标题用中文原创；README 附原创声明。
5. **5 张地图**：①青青草原（教学/木冰）②沙漠遗迹（石头+山坡）③雪山冰川（冰面低摩擦）④火山熔岩（石+TNT）⑤云端天空城（浮空平台+混合），各 20 关，地图专属配色/装饰/雾。

## 阶段（Stage-Gate，每阶段验证后才进入下一阶段）

### Stage 0 — 工程基建 ✔（本轮）
- plan.md、verifier/v1（静态检查脚本+验收标准）、更新 PRD v3.0 / task_plan / ISSUES（游戏公司流程文档）
- 验收：verifier 静态检查对自身通过

### Stage 1 — 核心引擎（手感层）
- js/config.js（全部数值常量）、js/models.js（猪/鸟/块/弹弓/5 套地图主题装饰建模）、js/audio.js（Web Audio 程序化音效，卡通原创）
- js/game.js 核心：弹弓拖拽/轨迹预测/发射、cannon 物理+伤害模型（冰1木3石6HP，阈值模型）、炸弹猪固定3伤线性衰减、飞速猪×2.5持续加速、TNT 链爆、连击/飘分/慢动作/震屏/碎片、相机状态机（跟随→停顿→缓动回弹弓，瞄准锁定）、鸟AI（飞鸟绕障飘移/站鸟1/2平台跑动/表情）、物理预演算
- 验收：verifier 静态+Node 物理冒烟测试全绿；本地起服务器可运行

### Stage 2 — UI/UX 与 5 地图框架
- index.html（vendored 引用）、css/style.css（横屏 HUD/菜单/关卡选择 5 地图分页/结算/暂停/新手引导/竖屏提示）
- 地图主题切换（天空/地面/雾/装饰/光照）
- 验收：浏览器工具截图核查各界面；无 JS 报错

### Stage 3 — 关卡管线与 100 关生产
- tools/generate_levels.js（5 地图模板×难度曲线，种子确定性，自动修复循环）
- tools/headless_sim.js（Node 加载 cannon+关卡，复用 game 的物理配置）
- tools/solver.js（自动玩家：候选弹道搜索，证明每关可用给定猪数通关）
- 产出 js/levels.js（100 关静态数据）
- 验收：verifier 物理检查 100 关全过；求解器通过率 100%（不达标自动修）

### Stage 4 — 总体验证（verifier 全量）
- verifier/v1: 静态（语法/模式/IP禁用词/关卡数与分布/阈值）+ 物理（稳定/不穿插/无NaN）+ 求解器可通关
- 浏览器实测截图（菜单/游玩/命中反馈/结算）
- verifier/runs/ 记录每次运行

### Stage 5 — 发布
- README（玩法/原创声明/本地运行）、PRD v3.0 定稿、CHANGELOG
- 经 GitHub API/MCP push_files 推送 main → Pages 自动构建 → API 确认 build 成功 → 抽查线上 HTML
- 最终报告 + 验收指引

## 文件契约（Stage 1/3 的接口约定）
- 关卡数据：`LEVELS=[{id,map,name,pigTypes[],birds[{type,x,y,z,range}],blocks[{type,x,y,z,w,h,d,rotY}],hills[],twoStar,threeStar}]`，`MAPS=[{id,name,icon,theme{sky,fog,ground,accent,decor}}]`
- 物理配置单一来源：js/config.js 同时被浏览器与 Node 工具加载（UMD 风格导出）
- 猪类型：normal/speed/bomb；材质：ice/wood/stone + tnt
