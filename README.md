# 景区 AI 智能聊天助手（演示版 v0.2.2）

基于 Vue 3 + Vant 4 + 硅基流动（OpenAI 兼容）+ vite-plugin-mock 的移动端演示项目。

**版本说明**：
- [v0.2.2](./docs/版本变动说明-v0.2.2.md)（当前）
- [v0.2.1](./docs/版本变动说明-v0.2.1.md)
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
| 新用户 | 无订单、无车牌；演示购票发券全流程；游游推荐含「出行前要准备什么？」 |
| 中级会员 | 有待出行订单；**不在园**见「帮我规划路线」，**在园**见「今日推荐路线」/停车/打卡；海洋公园有一笔可开票已完成单 |
| 高级会员 | 含自营 + OTA/TA 订单；演示订单只读查询、开票、虚拟排队、打卡 |

### 常用入口（Hash 路由，地址栏带 `#`）

| 页面 | 路径 |
|------|------|
| 登录 | `/#/login` |
| 聊天 | `/#/chat` |
| 后台配置 | `/#/config`（含助手 UI、业务场景；旧 `/#/admin/*` 自动跳转） |
| 批量开发票 | `/#/invoice/batch` |
| 我的 | `/#/profile` |

## 脚本

| 命令 | 说明 |
|------|------|
| `npm run dev` | 开发服务器（5172 + Mock） |
| `npm run build` | 类型检查 + 生产构建（默认 base=`/ai-assistant/`） |
| `npm run typecheck` | 仅 TypeScript 类型检查 |
| `npm run preview` | 预览构建产物（访问 `/ai-assistant/`） |

## 部署到公司服务器（子目录）

生产地址示例：`https://qa.ithongli.com/ai-assistant/#/login`（**Hash 路由**，刷新不会 404）

1. **重新打包**（产物在 `dist/`，资源路径已带 `/ai-assistant/` 前缀；生产包内置演示 Mock，登录与业务接口可离线演示）
   ```bash
   npm run build
   ```
2. **上传**：把 `dist/` **里面的内容**放到服务器的 `/ai-assistant/` 目录（需能访问到 `index.html` 与 `assets/`）。
3. **Nginx** 静态托管即可（Hash 模式下路由在 `#` 之后，一般无需 SPA `try_files`）：
   ```nginx
   location /ai-assistant/ {
     alias /path/to/ai-assistant/;   # 指向上传的 dist 内容
     try_files $uri $uri/ /ai-assistant/index.html;
   }
   ```
4. 浏览器强刷或清缓存后再访问：`https://qa.ithongli.com/ai-assistant/#/login`  
   选演示账号即可登录（无需本机 `npm run dev`）。

若部署在网站根路径而不是子目录，打包时覆盖 base：
```bash
# Windows PowerShell
$env:VITE_BASE_PATH="/"; npm run build
```

## 阶段二能力（Tool Calling + 游前购票）

### AI 对话（`/chat`）

- **Tool Calling**：`getOrders`、`getProductCatalog`、`generateTravelGuide` 等 10 个 Tool，步骤可在 `ToolProcessPanel` 查看
- Skill 关键词路由 + 语义补全（含 `ticket_purchase` / `travel_guide` / `member_offer` / `order_query` 等）
- NLU 增强说明见 [对话意图识别与LLM分工](./docs/对话意图识别与LLM分工.md)
- 意图与 LLM 分工说明：[`docs/对话意图识别与LLM分工.md`](./docs/对话意图识别与LLM分工.md)
- **业务卡片**：TicketCard、CouponCard、OrderCard、ContentCard、ActivityCard、GuideCard、VisitorPicker、QuizCard、StarIntroCard
- **欢迎页**：Hero 介绍气泡含 **当日景区天气**（本地 Mock）；底部**快捷服务**（`recommend_entries`，最多 4）+ **游游推荐**（`welcome_questions` + rules，最多 8；含 VIP 奇趣乐园「会员专属怎么买最划算？」）；均来自 `businessConfigStore`（JSON + `/config/business` LocalStorage）

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
| 1 | 新客多轮购票 | demo_new | 「第一次购票，有推荐的门票和优惠吗？」/「首次购票指引」→ 2大1小 + 日期 → 确认 → 下单支付 |
| 2 | 出行前准备 | demo_new/mid | 「出行前要准备什么？」→ 单条 full GuideCard |
| 3 | 路线互斥 | demo_mid | 不在园「帮我规划路线」；在园「今日推荐路线」/停车/打卡 |
| 4 | 停车缴费 | demo_mid | 在园时快捷「停车缴费」或「交停车费」→ `/parking` |
| 5 | OTA 订单只读 | demo_vip | 「查一下我的订单」 |
| 6 | 批量开发票 | demo_vip / mid | 快捷「开发票」（需当前景区有可开票单）→「立即开票」→ `/invoice/batch` |
| 7 | 演出推荐 | 任意 / mid | 「演出推荐」/「有哪些演出项目？」→ general；「今天有演出吗」→ today |
| 7b | 点名项目 | 奇趣乐园 | 「过山车」→「极限过山车」虚拟排队，不进演出列表 |
| 7c | 会员权益选品 | demo_vip @ 奇趣乐园 | 游游「会员专属怎么买最划算？」或「请按我的会员等级和优惠，推荐适合我的门票组合」→ 95 折+券+家庭套票/年卡 |
| 8 | 虚拟排队 | demo_vip | 「虚拟排队」→ 免费取号；「快速排队」→ ¥10 支付取号 |
| 9 | 园区打卡 | demo_vip | 「我要打卡」→ `/checkin` |
| 10 | 多景区 | 任意 | 上海两园 + **深圳仅绿野**可选；天气按园 Mock |

## 助手 UI 配置（简易后台）

**地址**：http://localhost:5172/config（也可 **我的 → 后台配置**）

可配置：助手名称/昵称、对话标题、主色、欢迎语、聊天背景、头像与 6 种形态图等。保存后写入 LocalStorage，聊天页即时生效。

## 聊天页欢迎态

当用户当天还没有真实对话记录时，展示欢迎界面：

- **Hero 天气**：介绍气泡「我是游游」上方一行（`scenicWeather.ts` 本地 Mock，如「今天景区天气 26°C，多云，适合出游」）
- **welcome_templates.json**：欢迎标题区 title / subtitle / body（按 persona）
- **welcome_questions.json**：**游游推荐**卡片（规则过滤，最多 8 条）；可在 `/config/business` 覆盖
- **RecommendEntry API**：**快捷服务**规则入口（交通指南、开发票、园区打卡等，最多 4 个）

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
├── 场景实现对照表.md
├── 业务场景配置与实现.md
├── 内容数据配置说明.md
├── 项目现状.md
├── 汇报串讲词-演示版.md
└── mini-program-routes.md
```

## 已知问题与改进

| 项 | 说明 |
|----|------|
| 子目录部署 | 生产 `base` 默认为 `/ai-assistant/`；路由为 Hash 模式（如 `/#/login`），刷新深链一般不依赖 SPA 回退 |
| 生产 Mock | 静态托管时通过 `mockProdServer` 在浏览器内拦截 `/api`（演示专用）；对接真实后端后应关闭 |
| 局域网预览 | `npm run preview` 后请打开带 base 的地址，如 `http://localhost:5172/ai-assistant/` |

## 方案文档

| 我想改… | 文档 |
|---------|------|
| 总方案与里程碑 | [落地计划](./docs/AI景区智能聊天助手-落地计划.md) |
| 当前进度与待办 | [项目现状](./docs/项目现状.md) |
| 汇报 / 演示串讲词 | [汇报串讲词-演示版](./docs/汇报串讲词-演示版.md) |
| 游前/游中/游后场景对照 | [场景实现对照表](./docs/场景实现对照表.md) |
| 攻略 / 提醒正文 | [内容数据配置说明](./docs/内容数据配置说明.md) |
| Skill / 领券 / 欢迎入口 | [业务场景配置与实现](./docs/业务场景配置与实现.md) |
| 小程序路径 | [mini-program-routes](./docs/mini-program-routes.md) |
