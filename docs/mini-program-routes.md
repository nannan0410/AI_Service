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

**入口**：RecommendEntry `review_service`（规则 `hasReviewableOrders=true`，demo_vip）；对话「我要点评」→ `review_service` Workflow → 对话内 `ReviewCard`（主路径）；`/review` 为兜底假页（同样支持 AI 草稿）。

**实现**：`src/utils/generateReviewDraft.ts`（输入：星级、标签、票种、景区名 + 关键词）。
