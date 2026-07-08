# 后台配置 — Element Plus PC 落地计划

> **文档用途**：将 `/config/*` 从 Vant 移动端样式升级为 **Element Plus PC 后台**，供后续开发落地参考。  
> **状态**：规划文档（未实施）  
> **更新日期**：2026-07-08  
> **前置**：方案 A 已完成（统一 `/config` 路由壳 + H5 预览入口 + Profile 单入口）

**相关文档：**

- 业务配置架构：[`业务场景配置与实现.md`](./业务场景配置与实现.md)
- 项目现状：[`项目现状.md`](./项目现状.md)
- 总方案：[`AI景区智能聊天助手-落地计划.md`](./AI景区智能聊天助手-落地计划.md)

---

## 1. 背景与问题

### 1.1 已完成（方案 A）

| 项 | 现状 |
|----|------|
| 路由 | `/config` 嵌套壳层；`/config/ui`、`/config/business`；旧 `/admin/*` redirect |
| 入口 | 「我的 → 后台配置」→ `/config` |
| H5 预览 | `ConfigLayout` 右上角「AI 客服 H5」→ `/chat` |
| 鉴权 | `meta.public: true`（演示版无需登录；正式上线再加账号） |
| 子页 | 仍使用 `src/pages/admin/AdminUiPage.vue`、`AdminBusinessPage.vue` |

### 1.2 待解决问题

配置页**视觉上仍是 H5 移动端**，原因：

1. 全站 `body { max-width: 430px }`（`src/styles/global.css`）
2. `ConfigLayout` 也限制 `max-width: 430px`
3. 子页使用 Vant 移动组件（`van-cell`、`van-tabs`、`van-switch` 等）
4. 与游客端共用同一 Vue App + Vant 主题

**目标**：`/config/*` 改为 **Element Plus PC 后台布局**；游客 H5（`/chat`、`/profile` 等）继续 Vant + 430px，互不影响。

---

## 2. 总体架构

```
┌─────────────────────────────────────────────────────────────┐
│  同一 Vue App（scenic-ai-assistant）                          │
├──────────────────────────┬──────────────────────────────────┤
│  游客 H5 路由             │  后台配置路由 /config/*            │
│  Vant 4 + 430px          │  Element Plus + 全宽 PC 布局       │
│  /chat /profile /orders… │  /config/ui /config/business     │
└──────────────────────────┴──────────────────────────────────┘
         │                              │
         └──────── 共享 ────────────────┘
              Pinia Store、utils、types、Mock API、LocalStorage merge 逻辑
```

### 2.1 设计原则

| 原则 | 说明 |
|------|------|
| **UI 分层、逻辑复用** | 只重写 Layout + 页面组件；`adminUiConfig.ts`、`adminBusinessConfig.ts`、`businessConfigStore`、`skillStore` 等不动 |
| **按需引入 EP** | 不在 `main.ts` 全局 `app.use(ElementPlus)`，避免污染 H5 页 |
| **路由级样式隔离** | 进入 `/config` 时切换 `body.layout-config`，解除 430px |
| **H5 预览不跳走** | PC 后台内用 Drawer + iframe 预览 `/chat`，更像运营工具 |
| **渐进迁移** | 新建 EP 版页面，路由切换后再删旧 Vant 版 |

---

## 3. 依赖与工程配置

### 3.1 安装

```bash
npm install element-plus @element-plus/icons-vue
npm install -D unplugin-element-plus   # 可选，按需样式
```

### 3.2 Vite（`vite.config.ts`）

**推荐**：config 目录内**手动 import** Element Plus 组件，不全局自动注册，减少与 Vant 冲突。

若使用 `unplugin-vue-components` 自动注册，需限制扫描范围：

```ts
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'

Components({
  resolvers: [
    VantResolver(),
    ElementPlusResolver({ importStyle: 'sass' }), // 或 'css'
  ],
  // 仅 config 相关目录参与 EP 自动注册（按实际目录调整）
  globs: ['src/pages/config/**/*.vue', 'src/components/config/**/*.vue'],
})
```

### 3.3 不在 main.ts 全局注册

```ts
// ❌ 不要
// import ElementPlus from 'element-plus'
// app.use(ElementPlus)

// ✅ 在 ConfigLayout 或各 config 页按需 import 组件 + 样式
import 'element-plus/es/components/message/style/css'
import 'element-plus/es/components/message-box/style/css'
```

可在 `src/pages/config/config-element.ts` 集中导出常用 EP 组件注册 helper（实施时创建）。

---

## 4. 布局与样式隔离

### 4.1 body class 切换

在 `src/router/guards.ts` 的 `afterEach` 中：

```ts
router.afterEach((to) => {
  document.body.classList.toggle('layout-config', to.path.startsWith('/config'))
})
```

### 4.2 新增样式文件 `src/styles/config-layout.css`

在 `main.ts` 中 import（或与 global.css 合并）：

```css
/* 默认 H5：global.css 已有 body { max-width: 430px } */

body.layout-config {
  max-width: none;
  margin: 0;
  box-shadow: none;
  background: #f0f2f5;
}

body.layout-config #app {
  min-height: 100vh;
}
```

### 4.3 ConfigLayout 改造要点

- 删除 `max-width: 430px`
- 使用 `el-container` / `el-aside` / `el-header` / `el-main`
- 侧栏 `el-menu` + `router` 模式跳转 `/config/ui`、`/config/business`
- 顶栏右侧：「预览 AI 客服 H5」打开 `el-drawer` + iframe

**目标布局示意：**

```
┌──────────┬────────────────────────────────────────┐
│ 侧栏 220px│ 顶栏：页面标题          [预览 AI 客服 H5] │
│          ├────────────────────────────────────────┤
│ ● 助手 UI │                                        │
│ ● 业务场景│  <router-view />（EP 表单 / 表格）       │
│          │                                        │
└──────────┴────────────────────────────────────────┘
```

### 4.4 H5 预览 Drawer

```vue
<el-drawer v-model="h5Visible" title="AI 客服 H5 预览" size="430px" destroy-on-close>
  <iframe src="/chat" class="config-h5-frame" />
</el-drawer>
```

```css
.config-h5-frame {
  width: 100%;
  height: calc(100vh - 120px);
  border: 1px solid #dcdfe6;
  border-radius: 12px;
}
```

> iframe 内 `/chat` 仍走 H5 样式；若需带登录态，确保 token 在同域 cookie/localStorage 下可用。

---

## 5. 页面迁移计划

### 5.1 目标文件结构

```text
src/pages/config/
├── ConfigLayout.vue           # EP 后台壳（改造现有文件）
├── ConfigUiPage.vue           # 新建，替代 AdminUiPage
├── ConfigBusinessPage.vue     # 新建，替代 AdminBusinessPage
└── config-element.ts          # 可选：EP 组件/消息封装

src/pages/admin/               # 迁移完成后删除或归档
├── AdminUiPage.vue            # 旧 Vant 版（参考用）
└── AdminBusinessPage.vue

src/components/config/         # 可选：可复用 EP 子组件
├── ConfigPageHeader.vue
├── ConfigActionBar.vue
└── SkillEditorDrawer.vue
```

### 5.2 路由切换（实施最后一步）

```ts
// src/router/index.ts
{
  path: 'ui',
  component: () => import('@/pages/config/ConfigUiPage.vue'),
},
{
  path: 'business',
  component: () => import('@/pages/config/ConfigBusinessPage.vue'),
},
```

### 5.3 Vant → Element Plus 组件对照

| Vant（现有） | Element Plus（目标） |
|--------------|----------------------|
| `van-nav-bar` | Layout 顶栏（子页不再单独 NavBar） |
| `van-tabs` | `el-tabs` |
| `van-notice-bar` | `el-alert type="info" show-icon` |
| `van-cell` + `van-switch` | `el-table` + `el-switch`，或 `el-form` + `el-switch` |
| `van-field` | `el-input` / `el-form-item` |
| `van-uploader` | `el-upload`（注意 LocalStorage 大小限制不变） |
| `van-popup` / `van-action-sheet` | `el-dialog` / `el-drawer` |
| `van-tag` | `el-tag` |
| `showConfirmDialog` | `ElMessageBox.confirm` |
| `appToast` | `ElMessage.success / error / warning` |

### 5.4 ConfigUiPage（助手 UI）

**布局建议**：左右两栏（`el-row` + `el-col`）

| 左栏（表单） | 右栏（预览） |
|-------------|-------------|
| 助手名称 / 昵称 / 对话标题 | 保留现有 preview stage 逻辑 |
| 主色 / 浅色 / 深色 | 欢迎语气泡预览 |
| 背景图 / 头像 / 会员默认头像 | 动作图预览（可选折叠） |
| 欢迎语（含 `{{assistantNickname}}` 占位符说明） | |

**底部操作**（`el-affix` 或固定 footer）：

- 保存配置
- 保存并预览 H5（保存后打开 Drawer iframe）
- 恢复 JSON 默认

**复用逻辑来源**：`AdminUiPage.vue` 的 script（`buildPatch`、`persistPatch`、`getAdminUiOverride` 等）。

### 5.5 ConfigBusinessPage（业务场景）

**顶层 Tab**：`el-tabs` — Skill 场景 | 欢迎页入口

#### Tab 1：Skill 场景

| 区域 | EP 组件 |
|------|---------|
| Skill 列表 | `el-table`：名称、skillId、状态、操作 |
| 行内开关 | `el-switch`（enabled） |
| 编辑 | `el-drawer`（宽 480～560px） |
| 触发关键词 | `el-tag` + `el-input`（子意图 locked 用 `type="info"` 不可删） |
| 绑定工具 | `el-select` multiple |
| 场景指令 | `el-input type="textarea"` |

**复用逻辑**：`validateSkillTriggerKeywords`、`mergeLockedKeywordsIntoTriggerKeywords`、`toolRegistry` 等。

#### Tab 2：欢迎页入口

子 Tab 或分段：

- 快捷服务（recommend_entries）
- 游游推荐（welcome_templates）
- 卡片展示配置（只读，来自 card_views）
- 规则字段目录（只读，来自 field_catalog）
- 规则预览（三演示账号，`el-row` + 3 × `el-card`）

**复用逻辑**：`previewRecommendEntries`、`buildDemoRuleContext`、`flattenWelcomeQuestions` 等。

**底部操作**：

- 保存配置
- 保存并预览 H5
- 恢复 JSON 默认
- 清除演示信息（`resetDemoBusinessData` + `clearDemoClientStorage`）

---

## 6. 不变的部分（实施时不要改）

| 项 | 说明 |
|----|------|
| LocalStorage Key | `scenic_admin_ui_override`、`scenic_admin_business_override`（兼容已有演示数据） |
| Mock API | `/api/admin/field-catalog` 等路径可暂不改 |
| Store | `assistantStore`、`businessConfigStore`、`skillStore` |
| Utils | `adminUiConfig.ts`、`adminBusinessConfig.ts`、各类 validation / merge |
| JSON 数据源 | `src/mock/assistant/*.json` |
| 鉴权 | 继续 `public: true`，正式上线再加运营账号 |

---

## 7. 分阶段实施清单

### Phase 1：基础设施（约 0.5 天）

- [ ] 安装 `element-plus`、`@element-plus/icons-vue`
- [ ] 新增 `src/styles/config-layout.css`
- [ ] `guards.ts` 增加 `body.layout-config` 切换
- [ ] 改造 `ConfigLayout.vue` 为 EP 侧栏 + 顶栏 + H5 Drawer iframe
- [ ] 验证：进入 `/config` 全宽；离开 `/config` 恢复 430px H5

### Phase 2：助手 UI 页（约 1～2 天）

- [ ] 新建 `ConfigUiPage.vue`（EP 表单 + 右侧预览）
- [ ] 消息/确认框改用 `ElMessage` / `ElMessageBox`
- [ ] 路由 `config/ui` 指向新页
- [ ] 手动测试：保存、恢复默认、图片上传、预览 H5

### Phase 3：业务场景页（约 2～3 天）

- [ ] 新建 `ConfigBusinessPage.vue`
- [ ] Skill 表格 + Drawer 编辑器
- [ ] 快捷服务 / 游游推荐编辑
- [ ] 规则预览三账号卡片
- [ ] 路由 `config/business` 指向新页
- [ ] 手动测试：关键词校验、规则预览、清除演示数据

### Phase 4：收尾（约 0.5 天）

- [ ] 删除或归档 `src/pages/admin/AdminUiPage.vue`、`AdminBusinessPage.vue`
- [ ] 更新 `README.md`、`docs/项目现状.md`
- [ ] 全站回归：H5 页无 EP 样式泄漏；config 页无 Vant 布局异常

---

## 8. 测试要点

| 场景 | 预期 |
|------|------|
| `/chat` 在 PC 浏览器 | 仍 430px 居中，Vant 样式正常 |
| `/config` 在 PC 浏览器 | 全宽 EP 后台，侧栏可切换 Tab |
| H5 预览 Drawer | iframe 内聊天页可交互，配置保存后刷新 iframe 可见 |
| 未保存直接预览 | iframe 显示上次保存结果；Alert 提示未保存不生效 |
| LocalStorage 已有数据 | 升级后仍能读取旧 key |
| `/admin/ui` 旧链接 | 仍 redirect 到 `/config/ui` |
| 移动端打开 `/config` | 可用但体验偏 PC；演示场景以 PC 为主 |

---

## 9. 正式上线扩展（后续，不在本次范围）

| 项 | 方向 |
|----|------|
| 鉴权 | `/config/*` 去掉 `public`，运营账号登录；H5 游客端不变 |
| 持久化 | LocalStorage → `GET/PUT /api/config/ui`、`/api/config/business` |
| 独立部署 | 可选拆 `apps/config-console` 子项目，共享 `packages/shared-config` |
| H5 预览 | iframe src 改为独立 H5 域名 + env 配置 |
| 审计 | 配置变更日志、版本回滚 |

---

## 10. 风险与注意

1. **Vant / EP 样式冲突**：严格按路由隔离；config 页避免 import Vant 组件。  
2. **bundle 体积**：EP 按需引入，不要全量注册。  
3. **iframe 登录态**：同域下 token 共享；跨域需另行设计 postMessage。  
4. **图片 LocalStorage 配额**：`MAX_IMAGE_SIZE_BYTES` 逻辑保持不变。  
5. **AdminBusinessPage 体量大**（1400+ 行）：迁移时先抽 composable（如 `useSkillEditor`、`useRecommendEntryEditor`）再换 UI。

---

## 11. 关键文件索引（实施时对照）

| 文件 | 用途 |
|------|------|
| `src/pages/config/ConfigLayout.vue` | 当前 Vant 壳，待改 EP |
| `src/pages/admin/AdminUiPage.vue` | UI 配置逻辑参考 |
| `src/pages/admin/AdminBusinessPage.vue` | 业务配置逻辑参考 |
| `src/utils/adminUiConfig.ts` | UI LocalStorage merge |
| `src/utils/adminBusinessConfig.ts` | 业务 LocalStorage merge |
| `src/store/businessConfigStore.ts` | 运行时配置加载 |
| `src/store/skillStore.ts` | Skill 运行时 |
| `src/styles/global.css` | H5 430px 限制 |
| `src/router/guards.ts` | 鉴权 + 待加 layout class |
| `mock/config.ts` | `/api/admin/*` Mock |

---

## 12. 预估工时

| 阶段 | 工时 |
|------|------|
| Phase 1 基础设施 | 0.5 天 |
| Phase 2 助手 UI | 1～2 天 |
| Phase 3 业务场景 | 2～3 天 |
| Phase 4 收尾 | 0.5 天 |
| **合计** | **约 4～6 天** |

---

*本文档为规划用途；实施时以当时代码库为准，按 Phase 顺序推进并可微调组件拆分方式。*
