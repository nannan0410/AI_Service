# 小程序路由契约（草稿）

H5 演示版与微信小程序的路径对照，供产品化对接参考。

## 提交订单

| H5 | 小程序（示例） |
|----|----------------|
| `/order/submit` | `/pages/order/submit` |

**Query 参数**

| H5 | 小程序 | 说明 |
|----|--------|------|
| `draftId` | `orderDraftId` | 订单草稿 ID |
| — | `visitDate` | 游玩日期（草稿字段，H5 从 draft 读取） |
| — | `quantity` | 票数 / 人数（草稿字段） |

草稿创建时 **可不传游客**；下单页通过 `PATCH /api/order/draft` 绑定实名出行人后再支付。

**支付**：演示版在假页内 Mock 支付（`POST /api/order/submit`）；产品化接 `wx.requestPayment`。

**支付成功**：演示版 Mock 支付成功后跳转 **`/orders?tab=1`**（我的订单 · 待出行/已完成 Tab，Toast「支付成功」）；产品化可跳转支付结果页或订单详情。

## 我的订单

| H5 | 小程序（示例） |
|----|----------------|
| `/orders` | `/pages/orders/index` |

**Query 参数（Tab）**

| H5 `tab` | 说明 |
|----------|------|
| `0` / `pending` | 待支付（默认） |
| `1` / `paid` / `travel` | **待出行/已完成**（欢迎「查看订单」、支付成功跳转使用） |
| `2` / `refunded` | 已退款 |

欢迎页 RecommendEntry `view_orders` 配置：`targetPath: "/orders?tab=1"`。

## 停车缴费

| H5 | 小程序（示例） |
|----|----------------|
| `/parking` | `/pages/parking/index` |

**Query 参数**

| H5 `mode` | 说明 |
|-----------|------|
| `pay` | 已绑定车牌时直达查询费用/支付页（对话引导卡跳转使用） |
| `bind` | 直达绑定车牌页（未绑定时可选用） |

## 批量开票 ✅

| H5 | 小程序（示例） |
|----|----------------|
| `/invoice/batch` | `/pages/invoice/batch` |

**行为**：展示 30 天内已完成且 `invoiceStatus=none` 的订单；多选后 `POST /api/invoice/batch`（body: `{ orderIds: string[] }`），Mock 将订单标为 `applied`，成功后回 `/invoice`。顶栏/底栏与 H5 内容同宽。

**入口**：

1. 对话「开发票」→ Workflow 引导卡「立即开票」→ 本页  
2. 快捷推荐 `batch_invoice`（标题「开发票」）→ chat 自动发「开发票」→ 同上（**不直跳**本页）  
3. 规则展示账号：demo_vip（可开票订单 Mock 见 `demo_vip.json`）

## 第三方开票

| H5 | 小程序 |
|----|--------|
| `/invoice/external` | WebView 打开第三方 URL |

参数：`orderId`、`amount`

## 服务点评 ✅

| H5 | 小程序（示例） |
|----|----------------|
| `/review` | `/pages/review/index` |

**Query 参数**

| H5 | 说明 |
|----|------|
| `orderId` | 待评价订单号（对话引导卡跳转使用） |

**行为**：展示 90 天内已完成且 `reviewStatus=none` 的订单；1～5 星 + 可选标签 + 文案（≤200 字）；支持 **「帮我写评价」**（LLM 或离线模板生成约 50 字草稿，填入后可改再提交）；`POST /api/reviews/submit`（body: `{ orderId?, rating, tags?, content? }`），Mock 将订单标为 `reviewStatus=submitted`，成功后跳转 `/orders?tab=1`。

**入口**：对话「我要点评」→ ReviewCard；快捷推荐 `review_service`。

## 园区打卡 ✅

| H5 | 小程序（示例） |
|----|----------------|
| `/checkin` | `/pages/checkin/index` |

**行为**：展示打卡点列表；同点位当日仅一次；`POST /api/checkin` `{ spotId }` → 加积分、可选发 `cp_prod_checkin`；非在园不可打卡。

**入口**：

1. 对话「我要打卡」→「立即打卡」→ 本页  
2. 快捷推荐 `checkin_nearby`（`inPark=true`）→ chat 发「我要打卡」  
3. 首页快捷入口 `/checkin`

## 虚拟排队 ✅

| H5 | 小程序（示例） |
|----|----------------|
| `/queue/take?activityId=` | `/pages/queue/take` |
| `/queue/pay?activityId=` | `/pages/queue/pay` |

**行为**：仅在园可用。免费项目取号 `POST /api/virtual-queue/take`；付费快速排队 Mock 支付 `POST /api/virtual-queue/pay`。底栏与 H5 内容同宽（sticky，非视口通栏）。成功后展示「返回个人中心」→ `/`（登录成功落地页）。

**对话入口**（`queue_recommend`）：

1. 免费包：「虚拟排队」「排队少的项目」→ 2 卡，每卡「立即取号排队」  
2. 付费单：「快速排队」→ 极限过山车 +「¥10元快速排队」  
3. 点名项目名 → 单卡 + 对应 CTA  

**入口**：RecommendEntry `review_service`（规则 `hasReviewableOrders=true`，demo_vip）；对话「我要点评」→ `review_service` Workflow → 对话内 `ReviewCard`（主路径）；`/review` 为兜底假页（同样支持 AI 草稿）。

**实现**：`src/utils/generateReviewDraft.ts`（输入：星级、标签、票种、景区名 + 关键词）。

## AI 助手 / 多景区入口（P0）

| H5 | 小程序（示例） | 说明 |
|----|----------------|------|
| `/chat?scenicId=scenic_hlg` | 景区小程序进客服 | **独立景区入口**：强制该景区，并写入上次记忆 |
| `/chat` 或 `/chat?from=group` | 集团小程序 AI 入口 | **集团入口**：有 `lastScenicId` 则静默进入；否则弹窗必选 |

演示城市：上海 / 深圳。**启用**景区：`scenic_hlg`（上海奇趣乐园）、`scenic_hy`（上海海洋公园）、`scenic_sz_eco`（深圳绿野公园）。`scenic_sz_wt`（深圳湾）保留数据但 `enabled:false`。详见 [`多景区模式-落地计划.md`](./多景区模式-落地计划.md)。
