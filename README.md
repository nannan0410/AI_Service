# 景区 AI 智能聊天助手（演示版 v0.2.1）

基于 Vue 3 + Vant 4 + 硅基流动（OpenAI 兼容）+ vite-plugin-mock 的移动端演示项目。

**版本说明**：
- [v0.2.1](./docs/版本变动说明-v0.2.1.md)（当前）
- [v0.2.0](./docs/版本变动说明-v0.2.0.md)

## 快速开始

```bash
# 1. 安装依赖
npm install

# 2. 配置硅基流动 API Key（可选；未配置时使用离线占位回复 + Workflow 演示）
cp .env.example .env
# 编辑 .env，设置 VITE_SILICONFLOW_API_KEY

# 3. 启动开发服务器
npm run dev
```

| 项 | 说明 |
|----|------|
| 本地地址 | http://localhost:5172 |
| Mock API | 开发模式自动启用（`vite-plugin-mock`，无需单独命令） |
| 端口 | 固定 **5172**（`strictPort: true`，占用时会报错） |
| 局域网 | 终端会输出 Network 地址（已开启 `host: true`） |

启动后进入 **登录页**，选择演示账号：

| 账号 | 说明 |
|------|------|
| 新用户 | 无订单、无车牌；演示购票发券全流程 |
| 中级会员 | 三笔待出行订单（6-30 / 7-30 / 8-18）；出行日当天欢迎页「今日出行」；快捷服务含停车缴费 |
| 高级会员 | 含自营 + OTA/TA 订单；演示订单只读查询 |

### 常用入口

| 页面 | 路径 |
|------|------|
| 登录 | `/login` |
| 聊天 | `/chat` |
| 后台配置 | `/config`（含助手 UI、业务场景；旧 `/admin/*` 自动跳转） |
| 批量开发票 | `/invoice/batch` |
| 我的 | `/profile` |

## 脚本

| 命令 | 说明 |
|------|------|
| `npm run dev` | 开发服务器（5172 + Mock） |
| `npm run build` | 类型检查 + 生产构建 |
| `npm run typecheck` | 仅 TypeScript 类型检查 |
| `npm run preview` | 预览构建产物（5172） |

## 阶段二能力（Tool Calling + 游前购票）

### AI 对话（`/chat`）

- **Tool Calling**：`getOrders`、`getProductCatalog`、`generateTravelGuide` 等 10 个 Tool，步骤可在 `ToolProcessPanel` 查看
- Skill 关键词路由 + 语义补全（`ticket_purchase` / `travel_guide` / `order_query`）
- NLU 增强说明见 [对话意图识别与LLM分工](./docs/对话意图识别与LLM分工.md)
- 意图与 LLM 分工说明：[`docs/对话意图识别与LLM分工.md`](./docs/对话意图识别与LLM分工.md)
- **业务卡片**：TicketCard、CouponCard、OrderCard、ContentCard、ActivityCard、GuideCard、VisitorPicker
- **欢迎页**：底部**快捷服务**（原 RecommendEntry，最多 4）+ **游游推荐**卡片（原 welcome_templates，最多 6）；均来自 `businessConfigStore`（JSON + `/config/business` LocalStorage）

### 购票闭环（多轮对话）

| 步骤 | 路径 / 动作 |
|------|-------------|
| 触发购票 | 「首次购票指引」/「买票」/「两大一小」等 → 分步问人数、日期 |
| 推荐产品 | 单条消息：文案 + TicketCard（2大0小=成人票×张数，2大1小=家庭套票） |
| 确认订单 | 推荐卡「确认并生成订单」→ 生成草稿（含产品+日期+票数，**不含游客**） |
| 提交订单 | **`/order/submit?draftId=xxx`** → 选手实名出行人 → Mock 支付 |
| 支付完成 | **`/orders?tab=1`**（待出行/已完成 Tab） |
| 回聊天 | 支付成功 system 消息（可选） |

小程序等价路径见 [docs/mini-program-routes.md](./docs/mini-program-routes.md)。

### 主要 Mock API

| 接口 | 说明 |
|------|------|
| `GET /api/products/tickets?channel=self` | 自销票产品（推荐） |
| `POST /api/order/draft` | 创建订单草稿（可无游客；含 visitDate、quantity） |
| `PATCH /api/order/draft` | 更新草稿实名出行人 |
| `POST /api/order/submit` | 假页提交 + Mock 支付 |
| `GET /api/travel/guide` | 游玩攻略拼装 |
| `GET /api/assistant/recommend-entries` | 规则推荐入口 |

## 阶段二演示脚本

| # | 场景 | 账号 | 操作 |
|---|------|------|------|
| 1 | 新客多轮购票 | demo_new | 「首次购票指引」→ 2大1小 + 日期 → 确认 → `/order/submit` 选游客 → 支付 |
| 2 | 老客 2 大 0 小 | demo_mid | 「买票」→ 2 大无小孩 + 下周末 → 成人票×2 + 购票10元券营销 |
| 3 | 交通指南 | demo_mid | 「交通指南」（绑定最近未过期待出行订单） |
| 4 | 游玩攻略 | demo_mid | 「游玩攻略」或快捷服务「游玩攻略」 |
| 5 | 停车缴费 | demo_mid | 快捷服务「停车缴费」或「交停车费」→ 引导卡 → `/parking` |
| 5b | 今日出行 | demo_mid | 2026-06-30 当天打开 /chat → 游游推荐副标题「今日出行」 |
| 6 | OTA 订单只读 | demo_vip | 「查一下我的订单」 |
| 7 | 批量开发票 | demo_vip | 快捷「开发票」→ 对话「立即开票」→ `/invoice/batch` 勾选提交 |
| 7b | 对话开票 | demo_vip | 「开发票」→「您当前有X笔…」+「立即开票」；0 笔固定文案 |
| 7c | 演出推荐 | 任意 | 「演出推荐」/「今天有演出吗」→ 单条 scene_recommend |

## 助手 UI 配置（简易后台）

**地址**：http://localhost:5172/config（也可 **我的 → 后台配置**）

可配置：助手名称/昵称、对话标题、主色、欢迎语、聊天背景、头像与 6 种形态图等。保存后写入 LocalStorage，聊天页即时生效。

## 聊天页欢迎态

当用户当天还没有真实对话记录时，展示欢迎界面：

- **welcome_templates.json**：**游游推荐**卡片（标题/副标题/prompt，每 persona 最多 6 条）；可在 `/config/business` 覆盖
- **RecommendEntry API**：**快捷服务**规则入口（交通指南、查看订单、**开发票**（进对话发「开发票」）等，最多 4 个）

## 技术栈

- Vue 3 + TypeScript + Vite
- Vant 4（移动端 UI）
- Pinia + Vue Router（含登录守卫）
- vite-plugin-mock
- 硅基流动 OpenAI Compatible API

## 目录结构

```
src/
├── api/          # HTTP 接口层（business.ts）
├── ai/           # LLM、Tool、Skill、Workflow
├── mock/         # Mock JSON 数据
├── pages/config/  # 后台配置壳层
├── pages/admin/   # 配置子页（UI / 业务场景）
├── pages/order/  # 提交订单假页 /order/submit
├── store/        # Pinia
├── components/   # 含 chat/cards 业务卡片
config/
└── llm.config.ts # LLM 配置（不含密钥）
mock/             # vite-plugin-mock 处理器
docs/
├── AI景区智能聊天助手-落地计划.md
├── 业务场景配置与实现.md
├── 内容数据配置说明.md
├── 项目现状.md
└── mini-program-routes.md
```

## 方案文档

| 我想改… | 文档 |
|---------|------|
| 总方案与里程碑 | [落地计划](./docs/AI景区智能聊天助手-落地计划.md) |
| 当前进度与待办 | [项目现状](./docs/项目现状.md) |
| 攻略 / 提醒正文 | [内容数据配置说明](./docs/内容数据配置说明.md) |
| Skill / 领券 / 欢迎入口 | [业务场景配置与实现](./docs/业务场景配置与实现.md) |
| 小程序路径 | [mini-program-routes](./docs/mini-program-routes.md) |
