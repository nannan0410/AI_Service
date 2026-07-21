# 对话意图识别与 LLM 分工

> **文档用途**：梳理演示版聊天中「哪些场景用 LLM、哪些用代码/后端规则」，并说明购票流程为何不走 LLM。  
> **更新日期**：2026-07-21  
> **相关代码**：`ChatPage.vue` → `onSend`；`src/ai/workflow/*`；`src/ai/llm.ts`；`src/ai/skills/router.ts`

**相关文档：**

- 配置与 Workflow 索引：[`业务场景配置与实现.md`](./业务场景配置与实现.md) §2.5
- 购票流程规格：[`业务场景配置与实现.md`](./业务场景配置与实现.md) §12
- 落地总方案：[`AI景区智能聊天助手-落地计划.md`](./AI景区智能聊天助手-落地计划.md)

---

## 1. 总路由（用户发消息后）

入口：`src/pages/chat/ChatPage.vue` → `onSend`。

```
用户输入文本
    │
    ├─ skillStore.resolveSkill(text)     // skills.json triggerKeywords（关键词，非 LLM）
    │
    ├─① Workflow 层（代码正则，最高优先级）
    │     isNewGuestCouponClaimIntent      → runNewGuestCouponWorkflow
    │     ticket_purchase + 购票正则 / 已有会话 → runTicketPurchaseWorkflow
    │     travel_guide + 攻略正则           → runTravelGuideWorkflow
    │     order_query + 订单正则            → runOrderQueryWorkflow
    │
    ├─② 未命中 Workflow → sendChatMessage
    │     → LLM + Tool Calling（有 API Key）
    │     → 或 runOfflineToolFallback（无 Key，正则选 Tool，仅演示）
    │
    └─③ formatters → 业务卡片 / 文本回复
```

**优先级**：Workflow 正则 > Skill 关键词 > LLM / 离线兜底。

**说明**：UI 上的「理解用户意图」步骤（`aiExecutionStore`）是展示用；命中 Workflow 时会立刻 `markIntentDone()`，**并不调用 LLM 做意图分类**。

---

## 2. 场景对照表

| 场景 | 触发方式 | 主要实现 | 是否用 LLM | 正式版建议 |
|------|----------|----------|------------|------------|
| **新客领券** | 代码正则，最高优先级，无 Skill | `src/utils/newGuestCoupon.ts` → `runNewGuestCouponWorkflow` | ❌ | **保持规则**；领券需精准、可审计 |
| **智能购票（入口）** | Skill 关键词 + 购票正则，或已有 `purchaseSession` | `ticketPurchase.ts` + `purchaseStore` | ❌ | **混合**：入口可用 LLM/NLU，流程仍走状态机 |
| 购票·人数 | Workflow 内正则 + **LLM 补槽** | `ticketPartyParser.ts` + `src/ai/nlu/` | ⚡ 混合 | 已实现 P0-1 |
| **购票·日期** | Workflow 内正则 + **LLM ISO** | `visitDateParser.ts` + `src/ai/nlu/` | ⚡ 混合 | 已实现 P0-1 |
| **购票·确认** | 推荐卡按钮点击 | `ChatPage.onTicketConfirm` | ❌ | **保持规则**（不用打字「确认」） |
| **购票·选品/算价** | 规则引擎 | `recommend.ts`、`couponDiscount.ts` | ❌ | **保持规则**；不宜交给 LLM |
| **购票·营销券** | 规则 | `purchaseMarketing.ts` | ❌ | **保持规则** |
| **游玩攻略** | Skill + 攻略正则 + **LLM 子意图** | `travelGuideIntent.ts` + `nlu/classifyTravelGuideIntent.ts` | ⚡ 混合 | 已实现 P0-3 |
| **订单查询** | Skill + 订单正则 | `orderQuery.ts` | ❌ | **可保持规则** |
| **发票服务** | Skill + 发票正则 | `invoiceService.ts` | ❌ | **保持规则**；引导假页 |
| **停车缴费** | Skill + 停车正则 | `parkingPay.ts` | ❌ | **保持规则**；引导假页 |
| **服务点评（入口）** | Skill + 点评正则 | `reviewService.ts` → ReviewCard | ❌ | **保持规则** |
| **服务点评·帮我写评价** | 卡片/假页按钮 | `generateReviewDraft.ts` | ⚡ 混合 | LLM≈50 字；无 Key 离线模板；**不自动提交** |
| **Skill 路由** | 关键词 + **LLM 语义补全** + **高置信进 Workflow** | `nlu/classifySkill.ts` + `skillWorkflowGate.ts` | ⚡ 混合 | P0-2 MVP + 增强 |
| **通用对话 + Tool** | 未命中 Workflow | `llm.ts` → `sendChatMessage` | ✅（有 Key） | **保持 LLM** |
| **离线兜底** | 无 API Key | `runOfflineToolFallback` | ❌ | **仅演示**；正式版用 LLM 或后端意图服务 |
| **欢迎页入口展示** | 规则引擎 | `ruleEngine.ts` + `recommend_entries.json` | ❌ | **保持规则** |
| **欢迎页点击文案** | 固定 prompt | `welcome_templates.json` | ❌ | **保持配置** |

---

## 3. Workflow 详解（均不走 LLM）

### 3.1 新客领券

| 项 | 说明 |
|----|------|
| 判断 | `isNewGuestCouponClaimIntent(message)` |
| 示例 | 「领新客券」「新人优惠券怎么领」 |
| 排除 | 消息含「买票 / 两大一小 / 套票」等购票词时不走领券 |
| 文件 | `src/utils/newGuestCoupon.ts`、`src/ai/workflow/newGuestCoupon.ts` |

无独立 Skill；命中后 **直接 Workflow，不走 LLM**。

### 3.2 智能购票

| 项 | 说明 |
|----|------|
| 入口条件 | `purchaseStore.session !== null`（且未被其它明确意图打断）**或**（Skill=`ticket_purchase` **且** `isTicketPurchaseIntent`） |
| 入口正则 | `shouldRunTicketWorkflow`：买票、两大一小、首次购票、买/购/订+门票等；**不含**裸门票 FAQ；**不含**人数/日期启发式冷启动 |
| 会话内 | `parsePartyFromMessage`、`parseVisitDateFromMessage`；确认靠推荐卡按钮 |
| 会话打断 | `shouldInterruptPurchaseSession`：明确攻略 / 营销 / 停车 / 订单 / 演出 / 发票 / 点评 / 领券 |
| 状态机 | `ask_party` → `ask_date` → `recommend` → `confirm` |
| 文件 | `src/ai/workflow/ticketPurchase.ts`、`src/store/purchaseStore.ts` |

**会话进行中**：后续「3人，下周末」「确认」等只依赖 Workflow 正则，**不再依赖 Skill 关键词**。

### 3.3 游玩攻略

| 项 | 说明 |
|----|------|
| 入口 | Skill=`travel_guide` + `shouldRunTravelGuideWorkflow` |
| 子意图（正则） | `isTrafficGuideIntent` / `isEntryNoticeIntent` / `isInParkRouteIntent` / `isFullTravelGuideIntent` |
| 子意图（P0-3） | 泛化说法（如「出行指南」）→ `resolveTravelGuideIntentRoute` → LLM 细分（含 `in_park`） |
| **园内路线** | demo_vip「为您推荐 → 今日推荐路线」或「猜你想问 → 排队少的项目」；识别在园游客后仅返回 **日程建议 + 推荐项目**，不含交通/入园 |
| 过程面板 | 走 LLM 时显示「识别攻略类型」 |
| 文件 | `src/utils/travelGuideIntent.ts`、`src/ai/nlu/resolveTravelGuideIntent.ts`、`src/ai/workflow/travelGuide.ts` |

### 3.4 订单查询

| 项 | 说明 |
|----|------|
| 入口 | Skill=`order_query` + `shouldRunOrderQueryWorkflow` |
| 行为 | 固定 `getOrders` + 模板文案 |
| 文件 | `src/ai/workflow/orderQuery.ts` |

### 3.5 发票服务

| 项 | 说明 |
|----|------|
| 入口 | Skill=`invoice_service` + `shouldRunInvoiceWorkflow`；快捷推荐发「开发票」 |
| 行为 | `getOrders` → 可开票：文案「您当前有X笔订单可以申请开票」+「立即开票」→ `/invoice/batch`；0 笔：「当前没有可申请开票的订单。」 |
| 文件 | `src/utils/invoiceIntent.ts`、`src/ai/workflow/invoiceService.ts` |

### 3.6 停车缴费

| 项 | 说明 |
|----|------|
| 入口 | Skill=`parking_pay` + 停车缴费正则 |
| 行为 | 查绑定车牌 → `PageGuideCard` → `/parking` |
| 文件 | `src/ai/workflow/parkingPay.ts`（及 `parkingIntent` 等） |

### 3.7 演出项目推荐

| 项 | 说明 |
|----|------|
| 入口 | Skill=`scenic_recommend` + `shouldRunShowScheduleWorkflow` |
| 行为 | `getScenicActivities` → **单条** `scene_recommend`；`dayKind`：today / tomorrow / day_after / general（「演出推荐」等） |
| 文件 | `src/utils/showScheduleIntent.ts`、`src/utils/showSchedule.ts`、`src/ai/workflow/showSchedule.ts` |

---

## 4. Skill 关键词路由（非 LLM）

实现：`src/ai/skills/router.ts` — 消息 **包含** `triggerKeywords` 即命中，更长关键词优先。

当前可路由 Skill（`enabled: true` 且在 `STAGE2_SKILL_IDS` 内）：

| skillId | 关键词示例 | 配置 |
|---------|-----------|------|
| `ticket_purchase` | 买票、购票、两大一小、首次购票… | `skills.json` |
| `travel_guide` | 交通、攻略、怎么去、入园须知… | `skills.json` |
| `order_query` | 订单、查订单、OTA… | `skills.json` |
| `invoice_service` | 发票、开票、报销、开发票、批量开票 | `skills.json` |
| `parking_pay` | 停车缴费、交停车费、车牌… | `skills.json` |
| `scenic_recommend` | 今日演出、演出推荐、灯光秀、花车… | `skills.json` |

作用：为 **LLM 路径** 注入 `promptAddon` 与 Tool 白名单。Workflow 命中时，Skill 主要参与 **入口判断**，不参与槽位填充。

未启用 Skill（`enabled: false`）：部分扩展场景 — 只能靠 LLM 通用模式或离线正则。  
**已启用 Workflow**：购票、攻略、订单、**发票**、停车、**演出场次**、点评、主动营销等见 `skills.json` + `src/ai/workflow/*`。

---

## 5. LLM 路径

触发：上述 4 类 Workflow **均未命中**。

| 环境 | 行为 |
|------|------|
| 有 API Key | `sendChatMessage` → LLM 根据 system prompt + Skill 上下文 **自行选择 Tool**（隐式意图识别） |
| 无 API Key | `runOfflineToolFallback`：正则选一个 Tool，模板化回复（**仅演示**） |

典型走 LLM 的情况：

- Skill 关键词命中，但 Workflow 二级正则未命中（如「门票有什么优惠」未进购票状态机）
- 未启用 Skill 的场景（主动营销、园区推荐等）
- 泛聊、兜底

---

## 6. 欢迎页（非发消息意图识别）

| 层级 | 机制 | 文件 |
|------|------|------|
| 展示哪些入口 | 规则引擎 `evaluateRules` + 用户状态 | `recommend_entries.json`、`ruleEngine.ts` |
| 点击后说什么 | 固定 `prompt` | `welcome_templates.json` |
| 新客券入口隐藏 | `canClaimNewGuestCoupon` | `newGuestCoupon.ts` |

点击 chip 后进入聊天，仍走 §1 路由链。

---

## 7. 购票流程的对话为何不用 LLM

这是产品/架构上的 **有意选择**，不是遗漏。演示版把购票做成 **确定性 Workflow（状态机 + 正则槽位 + 规则选品）**，而不是把整段对话交给 LLM 自由发挥。

### 7.1 业务需要「可预测、可验收」

购票是 **交易链路**：人数 → 日期 → 推券 → 选品 → 确认 → 草稿 → 下单页选出行人 → 支付。

| 要求 | 规则 Workflow | 纯 LLM 对话 |
|------|---------------|-------------|
| 每一步用户看到什么 | 固定话术 + 固定卡片 | 随模型措辞变化 |
| 产品推荐结果 | `recommendTicketByParty` 规则唯一 | 可能推荐错 SKU、错张数 |
| 价格与抵扣 | 后端/Mock 精确计算 | 易幻觉价格、券面额 |
| 测试用例 | 「2大1小 + 下周末」必出家庭套票 | 同输入不同 run 可能不同 |

景区票务涉及 **金额与库存**，演示与上线都需要 **同样输入、同样输出**，Workflow 更合适。

### 7.2 多轮状态必须可靠

购票是 **有状态多轮**（`purchaseStore.session.step`）：

```
ask_party → ask_date → recommend → confirm
```

LLM 每轮独立生成，**不天然记住**「已问过人数、还差日期」 unless 额外做结构化会话状态；当前实现用 **显式状态机** 保证：

- 人数未齐 → 只问人数
- 人数齐且同条含日期 → 跳过问日期（`advanceAfterPartyComplete`）
- 已在推荐阶段 → 「确认」走确认卡，而非重新闲聊

状态机在代码里 **单一真相源**，比让 LLM「自己记得流程」更稳。

### 7.3 结构化槽位比 NLG 更重要

购票关键不是「说得像人」，而是 **抽对结构化字段**：

| 槽位 | 当前实现 | 用途 |
|------|----------|------|
| 成人/儿童/老人 | `ticketPartyParser.ts` | 选成人票张数 vs 家庭套票 |
| 出行日期 | `visitDateParser.ts` | 写入 draft、展示在卡片 |
| 确认下单 | 推荐卡按钮 | `ChatPage.onTicketConfirm` → 订单草稿 |

这些槽位直接驱动 **API（getProductCatalog、getCoupons、createOrderDraft）**。用 LLM 做 NLG 可以，但 **槽位填错会导致下错单**；演示版先用正则保证 Demo 路径稳定。

### 7.4 卡片与跳转是强 UI 契约

购票产出是 **TicketCard / TicketConfirmCard / OrderCard**，字段含 `productId`、`quantity`、`visitDate`、`sessionId` 等。

Workflow **直接组装 `ChatMessageDraft`**，与 `MessageBubble`、下单页 `OrderSubmitPage` 契约一致。若 LLM 自由回复：

- 可能缺卡片或字段不全
- 确认后 `onTicketConfirm` 依赖 payload 结构
- 难以保证「去提交订单」跳转参数正确

**重操作跳 H5/小程序页** 的场景，更适合 **代码驱动 UI**，LLM 只适合作辅助（见 §7.6）。

### 7.5 成本、时延与离线演示

| 因素 | Workflow | 每轮 LLM |
|------|----------|----------|
| 延迟 | 本地正则 + Mock API | 每轮网络 + 推理 |
| 费用 | 无模型调用 | 多轮购票成本明显 |
| 无 Key 演示 | 完整可走通 | 只能走简陋 offline fallback |

项目 README 强调 **无 API Key 也可演示购票**；Workflow 使核心交易 Demo 不依赖 LLM 供应商。

### 7.6 正式版建议：混合而非替换

购票 **不应** 在正式版改为「全程 LLM 聊天下单」，建议：

| 层级 | 建议 |
|------|------|
| **流程编排** | **保持** Workflow 状态机 |
| **选品 / 算价 / 发券** | **保持** 规则与后端 API |
| **入口与槽位** | **LLM 增强**：从「3个大人下个周末去」抽 `{ adult: 3, visitDate: ... }`，再交给 Workflow |
| **话术** | 可选 LLM 润色固定步骤的回复，但不改变分支逻辑 |
| **确认** | **保持** 明确确认卡 + 用户点「确认」，避免 LLM 误判「好的」为下单 |

即：**LLM 做理解（NLU），Workflow 做决策（状态 + 业务规则）**。

### 7.7 与 LLM 路径的分工边界

| 用户说法 | 实际路径 | 原因 |
|----------|----------|------|
| 「我是新客，请带我完成首次购票指引」 | Workflow | 命中购票 Skill + 购票意图 |
| 「3人，下周末」 | Workflow（会话中） | 状态机 + 槽位解析 |
| 「确认」 | Workflow | 确认正则 → 确认卡 / 草稿 |
| 「门票一般多少钱？有什么活动？」 | **LLM** | 未进购票状态机，偏咨询 |
| 「两大一小有优惠吗」（未点首次购票） | 可能 Skill 命中 → 若 `isTicketPurchaseIntent` 则 Workflow，否则 LLM | 二级正则决定是否进状态机 |

---

## 8. 正式版演进建议（汇总）

```
                    ┌─────────────────────────────────┐
                    │  必须保持规则 / Workflow         │
                    │  选品、算价、发券、订单只读、     │
                    │  购票状态机、欢迎页规则           │
                    └─────────────────────────────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    │  建议 LLM 增强（不替换 Workflow） │
                    │  Skill 语义路由、购票槽位 NLU、   │
                    │  攻略子意图（P0-3 已做）         │
                    └───────────────┬───────────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    │  正式版应替换                    │
                    │  runOfflineToolFallback（演示）  │
                    │  → LLM 或后端意图分类服务         │
                    └─────────────────────────────────┘
```

---

## 9. 关键代码索引

| 用途 | 路径 |
|------|------|
| 总分发 | `src/pages/chat/ChatPage.vue` → `onSend` |
| 购票 Workflow | `src/ai/workflow/ticketPurchase.ts` |
| 购票会话 | `src/store/purchaseStore.ts` |
| 人数 / 日期解析 | `src/utils/ticketPartyParser.ts`、`src/utils/visitDateParser.ts` |
| **购票 NLU（P0-1）** | `src/ai/nlu/extractPurchaseSlots.ts`、`resolvePurchaseSlots.ts` |
| **Skill 语义路由（P0-2）** | `classifySkill.ts`、`resolveSkillRoute.ts`、`skillWorkflowGate.ts` |
| **攻略子意图 NLU（P0-3）** | `src/ai/nlu/classifyTravelGuideIntent.ts`、`resolveTravelGuideIntent.ts` |
| LLM 客户端 | `src/ai/llm/client.ts` |
| 选品规则 | `src/ai/workflow/recommend.ts` |
| LLM 入口 | `src/ai/llm.ts` |
| Skill 路由 | `src/ai/skills/router.ts`、`src/mock/assistant/skills.json` |
| 新客领券意图 | `src/utils/newGuestCoupon.ts` |
| 攻略意图 | `src/utils/travelGuideIntent.ts` |

---

## 11. P0-1 已实现：购票槽位 LLM 增强

### 11.1 行为

每轮购票 Workflow 用户消息会调用 `resolvePurchaseSlotsFromMessage`：

1. **有 API Key** 且未关闭时，**优先**调用 LLM 提取 JSON 槽位（含 session 上下文：当前 step / 已有人数 / 已有日期）
2. **无 Key / LLM 失败**：回退正则解析人数与日期
3. 日期经 `validateIsoVisitDate` 校验；支持「8 月中旬」等模糊说法（上/中/下旬规则见 prompt）
4. **无 Key 演示**：完全走正则，不影响 Workflow 闭环

### 11.2 配置

| 项 | 位置 |
|----|------|
| 开关 | `config/llm.config.ts` → `nlu.purchaseSlots` |
| 环境变量关闭 | `.env` 设置 `VITE_ENABLE_PURCHASE_NLU=false` |
| 温度 | `nlu.purchaseSlotsTemperature`（默认 0.1） |

### 11.3 自测脚本

```bash
npx vite-node scripts/test-merge-purchase-slots.mts
```

---

## 12. P0-2 已实现：Skill 语义路由

### 12.1 MVP 行为

`skillStore.resolveSkillAsync` → `resolveSkillRoute`：

1. **关键词命中** → 直接返回 Skill（不调 LLM，过程面板无「语义识别」步）
2. **关键词未命中** + 有 API Key → LLM 分类 `ticket_purchase` / `travel_guide` / `order_query` / `general`
3. `confidence < 0.5` 或 `general` → 视为未命中 Skill

过程面板：语义路由时显示 **「语义识别对话场景」**；命中后场景步显示 `场景名（语义识别）`。

### 12.2 P0-2 增强（Workflow 入口）

`skillWorkflowGate.ts`：当 **LLM 路由** 且 `confidence ≥ 0.8`（可配置）时，可 **替代 Workflow 二级正则**，直接进入：

| Skill | 原二级正则 | 增强后 |
|-------|-----------|--------|
| `ticket_purchase` | `isTicketPurchaseIntent` | 或 LLM 高置信度 |
| `travel_guide` | `shouldRunTravelGuideWorkflow` | 或 LLM 高置信度 |
| `order_query` | `shouldRunOrderQueryWorkflow` | 或 LLM 高置信度 |

示例：「想带全家去买票」「上次买的票在哪看」→ 语义识别后进入购票 / 查单 Workflow。

**新客领券**仍最高优先级，不受本增强影响。

### 12.3 配置

| 项 | 位置 |
|----|------|
| 语义路由开关 | `llm.config.ts` → `nlu.skillRouting`；`.env` → `VITE_ENABLE_SKILL_NLU=false` |
| **Workflow 增强开关** | `nlu.skillRoutingWorkflowEnhancement`；`.env` → `VITE_ENABLE_SKILL_WORKFLOW_NLU=false`（仅关增强，保留 MVP） |
| 置信度阈值 | `nlu.skillRoutingWorkflowThreshold`（默认 **0.8**） |
| 温度 | `nlu.skillRoutingTemperature`（默认 0） |

### 12.4 自测

```bash
npx vite-node scripts/test-skill-route-keyword.mts
npx vite-node scripts/test-skill-workflow-gate.mts
```

---

## 13. P0-3 已实现：攻略子意图 LLM

### 13.1 行为

`runTravelGuideWorkflow` → `resolveTravelGuideIntentRoute`：

1. **正则已明确**（`isTrafficGuideIntent` / `isEntryNoticeIntent` / `isInParkRouteIntent` / `isFullTravelGuideIntent`）→ 直接用正则结果，**不调 LLM**
2. **泛化说法**（如「出行指南」「在园里怎么安排」仅命中宽泛关键词）→ LLM 分类 `traffic` / `entry_notice` / `in_park` / `full`
3. **无 Key / LLM 失败** → 回退正则默认（多为 `full`）

**园内路线（`in_park`）**：对齐 `welcome_templates.json` demo_vip「现在先玩哪里？」→ prompt「我现在在园区内，请根据当前位置和排队情况推荐今日路线。」；`generateTravelGuide(scope=in_park)` 仅拼装 **攻略正文（dayPlan）+ 推荐项目**，GuideCard **不展示**交通指南与入园提醒。

过程面板：走 LLM 时显示 **「识别攻略类型」**。

### 13.2 配置

| 项 | 位置 |
|----|------|
| 开关 | `llm.config.ts` → `nlu.travelGuideIntent` |
| 关闭 | `.env` → `VITE_ENABLE_TRAVEL_GUIDE_NLU=false` |
| 温度 | `nlu.travelGuideIntentTemperature`（默认 0） |

### 13.3 自测

```bash
npx vite-node scripts/test-travel-guide-intent-route.mts
```

---

## 10. 修订记录

| 日期 | 说明 |
|------|------|
| 2026-07-21 | 服务点评「帮我写评价」：LLM / 离线模板草稿（非 Workflow；不自动提交） |
| 2026-07-21 | 发票对话：X笔+立即开票→批量页；0笔固定文案；演出 `scene_recommend` / general；快捷开发票走 chat |
| 2026-06-19 | 园内路线子场景：`in_park` 意图，猜你想问「现在先玩哪里」不含交通/入园 |
| 2026-06-24 | P0-2 增强：高置信度 LLM Skill 进入 Workflow |
| 2026-06-24 | P0-3：攻略子意图 LLM + 过程面板 |
| 2026-06-24 | P0-2 MVP：Skill 语义路由 + 过程面板 |
| 2026-06-24 | P0-1：购票槽位 LLM + 正则合并 |
| 2026-06-24 | 初版：意图分层梳理 + 购票不用 LLM 的设计说明 |
