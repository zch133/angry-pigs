## 搭建 3D 引擎基础骨架（tracer bullet）

**From PRD:** /home/z/my-project/angry-pigs/PRD.md (R1, R6, R12)
**Acceptance:**
- Three.js + cannon-es 通过 CDN 加载，浏览器打开 index.html 能看到一个 3D 场景
- 场景包含：天空盒（渐变蓝）、草地地面、方向光 + 环境光
- 摄像机为默认斜俯视角，看着场景中心
- 相机锁定/解锁按钮存在且功能正常：锁定时不响应操作，解锁时桌面右键拖拽旋转+滚轮缩放，手机单指拖拽+双指捏合
- 按钮状态视觉上可区分（锁定/解锁）
- 竖屏时显示"请横屏游玩"提示
- 有一个 requestAnimationFrame 渲染循环在跑

### Context
- ADR-0001：Three.js + cannon-es
- 这是所有后续 issue 的基础——引擎、渲染循环、相机、场景
- Tracer bullet：端到端薄切片，证明架构可行

### Scope
- In: HTML 骨架、Three.js/cannon-es CDN 引入、场景搭建、光照、相机系统（含锁定按钮）、渲染循环、竖屏提示
- Out: 游戏逻辑、角色建模、物理模拟、UI 菜单

### Notes
- 旧的 2D 代码全部删除，从零开始
- Three.js 和 cannon-es 都用 CDN
- 相机用 OrbitControls 但加锁定开关
- 虚拟坐标系不需要，3D 直接用世界坐标
