# 景区 AI 智能聊天助手（演示版）

基于 Vue 3 + Vant 4 + DeepSeek + vite-plugin-mock 的移动端演示项目。

## 快速开始

```bash
# 安装依赖
npm install

# 配置 DeepSeek API Key（可选，未配置时使用离线占位回复）
cp .env.example .env
# 编辑 .env，设置 VITE_DEEPSEEK_API_KEY

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

- **主色** / 浅色背景（对话框按钮、用户气泡等）
- **聊天背景图**（上传或粘贴 URL）
- **助手头像**（欢迎页 + 对话头像）

保存后写入浏览器 LocalStorage，聊天页 `/chat` 即时生效。点击「恢复 JSON 默认」可回到 `src/mock/assistant/ui_config.json`。

## 技术栈

- Vue 3 + TypeScript + Vite
- Vant 4（移动端 UI）
- Pinia + Vue Router（含登录守卫）
- vite-plugin-mock
- DeepSeek OpenAI Compatible API

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
