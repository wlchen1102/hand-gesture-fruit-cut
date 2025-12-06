# 🎮 手势切水果游戏

一个基于 AI 手势识别的互动式切水果游戏，使用你的双手来切水果、避开炸弹，体验水果忍者的乐趣！

![游戏演示](https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6)

## ✨ 项目特色

- **🤖 AI 手势识别**：使用 MediaPipe Hands 技术，实时识别手部动作
- **🍎 丰富的水果类型**：苹果、橙子、香蕉、草莓、西瓜等多种水果
- **💣 刺激的炸弹挑战**：准确避开炸弹，误切会扣生命值
- **⚡ 连击系统**：连续切割获得更高分数和特殊音效
- **🎨 炫酷视觉效果**：粒子爆炸、刀光剑影、霓虹文字效果
- **🔊 沉浸式音效**：切割音效、爆炸声、连击提示音
- **📱 响应式设计**：完美适配桌面和移动设备

## 🎯 游戏玩法

### 基本操作
1. **启动游戏**：点击开始按钮，允许摄像头权限
2. **手势切水果**：用食指在屏幕前快速滑动来切割水果
3. **避开炸弹**：看到 💣 炸弹时不要切割，否则会扣生命值
4. **获得分数**：每个水果 10 分，连击可获得额外分数

### 游戏规则
- **生命值**：玩家初始有 3 条生命
- **连击奖励**：连续切割（800毫秒内）可触发连击模式
- **难度递增**：随时间推移，水果下落速度逐渐增加
- **失败条件**：生命值归零时游戏结束

## 🛠️ 技术栈

- **前端框架**：React 18 + TypeScript
- **构建工具**：Vite 7
- **AI 引擎**：MediaPipe Hands（Google）
- **图形渲染**：Canvas 2D API
- **样式框架**：TailwindCSS
- **音频系统**：Web Audio API
- **部署平台**：AI Studio

## 🚀 快速开始

### 环境要求
- Node.js 16+ 
- 现代浏览器（支持 WebRTC 和 WebAssembly）
- 摄像头设备

### 安装步骤

1. **克隆项目**
   ```bash
   git clone <repository-url>
   cd hand-gesture-fruit-cut
   ```

2. **安装依赖**
   ```bash
   npm install
   ```

3. **启动开发服务器**
   ```bash
   npm run dev
   ```

4. **访问游戏**
   打开浏览器访问 `http://localhost:5173`

### 构建部署

```bash
# 构建生产版本
npm run build

# 预览构建结果
npm run preview
```

## 📁 项目结构

```
hand-gesture-fruit-cut/
├── src/
│   ├── App.tsx              # 主游戏逻辑
│   ├── types.ts             # TypeScript 类型定义
│   ├── services/
│   │   └── audioService.ts  # 音频服务
│   └── ...
├── public/                  # 静态资源
├── package.json            # 项目配置
├── vite.config.ts          # Vite 配置
├── tailwind.config.js      # TailwindCSS 配置
└── README.md               # 项目说明
```

## 🎮 核心功能

### 手势识别系统
- **实时追踪**：使用 MediaPipe 实时追踪手部 21 个关键点
- **精准检测**：食指指尖位置作为切割判定点
- **性能优化**：60fps 流畅识别，支持热重载

### 物理引擎
- **重力系统**：真实的水果下落物理效果
- **碰撞检测**：精确的切割判定算法
- **粒子效果**：切割后的水果分裂和爆炸特效

### 音效系统
- **切割音效**：高频锯齿波模拟刀刃切割声
- **爆炸音效**：低频方波模拟炸弹爆炸
- **连击音效**：和弦音效提示连续切割

## 🔧 开发指南

### 自定义配置

#### 调整游戏难度
```typescript
// 在 App.tsx 中修改这些常量
const GRAVITY = 0.15;           // 重力强度
const SPAWN_RATE_INITIAL = 120; // 生成频率
const BOMB_CHANCE = 0.15;       // 炸弹概率
```

#### 添加新水果
```typescript
const FRUIT_TYPES = [
  { color: '#FF0000', size: 45, emoji: '🍎' }, // 苹果
  { color: '#FFA500', size: 50, emoji: '🍊' }, // 橙子
  // 在这里添加新的水果类型
];
```

### 调试模式
游戏内置了画中画调试视图，显示：
- 摄像头实时画面
- 手部关键点检测
- 手势追踪轨迹

## 🌐 浏览器兼容性

| 浏览器 | 版本要求 | 手势识别 | 音效支持 |
|--------|----------|----------|----------|
| Chrome  | 88+      | ✅        | ✅        |
| Firefox | 85+      | ✅        | ✅        |
| Safari  | 14+      | ⚠️        | ✅        |
| Edge    | 88+      | ✅        | ✅        |

⚠️ Safari 需要用户主动授权音频播放

## 🐛 常见问题

### Q: 摄像头无法启动？
A: 
- 检查浏览器权限设置
- 确保没有其他应用占用摄像头
- 尝试刷新页面重新授权

### Q: 手势识别不准确？
A:
- 确保光线充足
- 保持手部在摄像头视野内
- 避免背景过于复杂

### Q: 游戏卡顿怎么办？
A:
- 关闭其他占用 CPU 的程序
- 使用性能更好的浏览器
- 降低摄像头分辨率

## 🤝 贡献指南

欢迎提交 Issue 和 Pull Request！

### 开发流程
1. Fork 本项目
2. 创建特性分支：`git checkout -b feature/amazing-feature`
3. 提交更改：`git commit -m 'Add amazing feature'`
4. 推送分支：`git push origin feature/amazing-feature`
5. 创建 Pull Request

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情

## 🙏 致谢

- [MediaPipe](https://mediapipe.dev/) - Google 的手部识别技术
- [React](https://reactjs.org/) - 用户界面库
- [Vite](https://vitejs.dev/) - 下一代前端构建工具
- [TailwindCSS](https://tailwindcss.com/) - 实用优先的 CSS 框架

## 🔗 相关链接

- [在线体验](https://ai.studio/apps/drive/1w-K-yXNtfY08O03j7KC2L-3kYkwxrvWi)
- [问题反馈](https://github.com/your-username/hand-gesture-fruit-cut/issues)
- [功能建议](https://github.com/your-username/hand-gesture-fruit-cut/discussions)

---

**享受切水果的乐趣！🍉⚡**