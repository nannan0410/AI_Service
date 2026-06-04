# 景区 AI 智能聊天助手（演示版）

基于 Vue 3 + Vant 4 + 硅基流动（OpenAI 兼容）+ vite-plugin-mock 的移动端演示项目。

## 快速开始

```bash
# 安装依赖
npm install

# 配置硅基流动 API Key（可选，未配置时使用离线占位回复）
cp .env.example .env
# 编辑 .env，设置 VITE_SILICONFLOW_API_KEY

# 启动开发服务器
npm run dev
```

浏览器访问 `http://localhost:5172`，会先进入 **登录页**，选择演示账号：

| 账号 | 说明 |
|------|------|
| 新用户 | 无订单、无车牌 |
| 中级会员 | 有未游玩（paid）订单、已绑车牌 |
| 高级会员 | 有已完成订单、可演示发票 |

## 助手 UI 配置（简易后台）

**地址**：http://localhost:5172/admin/ui

也可登录后进入 **「我的」→ 助手 UI 配置**。

可配置：

- **助手名称** `assistantName`（配置/关于等正式名称，默认 `AI游游`）
- **助手昵称** `assistantNickname`（头像名称、对话自称、欢迎文案，默认 `游游`）
- **对话标题** `dialogTitle`（聊天页顶部副标题/标题，默认 `景区 AI 助手`）
- **主色** / 浅色背景 / 深色强调色 `primaryColorDark`（对话框按钮、用户气泡等）
- **欢迎语**（聊天预览气泡与欢迎页展示，可用 `{{assistantNickname}}` 自动插入昵称）
- **聊天背景图**（仅上传，建议 9:16，&lt; 800KB）
- **助手头像** `assistantAvatarUrl`（顶部头像、静态头像展示，默认 `/assistant/youyou_idle.png`）
- **助手默认图** `defaultImageUrl`（欢迎页没有对话记录时展示，默认 `/assistant/youyou.png`）
- **助手 6 种形态图** `motions`：`idle`、`thinking`、`nod`、`shake`、`wave`、`point`（用于对话头像，建议方形 JPG/PNG，&lt; 800KB）

保存后写入浏览器 LocalStorage，聊天页 `/chat` 即时生效。点击「恢复 JSON 默认」可回到 `src/mock/assistant/ui_config.json`。

## 聊天页欢迎态

AI 助手对话入口为 `src/pages/chat/ChatPage.vue`。当用户当天还没有真实对话记录时，会展示手机端欢迎界面：顶部助手信息、欢迎语气泡、导游形象、「猜你想问」问题卡片、底部 4 个快捷按钮和固定输入框。

欢迎态问题和快捷按钮配置在 `src/mock/assistant/welcome_templates.json`：

- `suggestedQuestions`：配置「猜你想问」问题、图标、发送给 AI 的提示词。
- `quickActions`：配置底部 4 个快捷按钮、颜色、图标、发送给 AI 的提示词。
- 三个演示身份已做差异化：新客展示新客券/首次购票，中级会员展示待出行订单和交通指南，高级会员展示在园路线/附近优惠/会员券。

## 技术栈

- Vue 3 + TypeScript + Vite
- Vant 4（移动端 UI）
- Pinia + Vue Router（含登录守卫）
- vite-plugin-mock
- 硅基流动 OpenAI Compatible API

## 目录结构

```
src/
├── api/          # HTTP 接口层
├── ai/           # LLM 与 Tool/Skill（llm.ts 为唯一 AI 入口）
├── mock/         # Mock JSON 数据
├── pages/admin/  # 简易配置后台
├── store/        # Pinia
├── pages/        # 页面
├── components/   # 组件
config/
└── llm.config.ts # LLM 配置（不含密钥）
mock/             # vite-plugin-mock 处理器
```

## 脚本

| 命令 | 说明 |
|------|------|
| `npm run dev` | 开发模式 |
| `npm run build` | 生产构建 |
| `npm run preview` | 预览构建结果 |

## 方案文档

详见 [docs/AI景区智能聊天助手-落地计划.md](./docs/AI景区智能聊天助手-落地计划.md)
