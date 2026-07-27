<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import {
  fetchActivities,
  fetchAdminTagCatalog,
  fetchAdminTagRules,
  fetchAssistantSkills,
  fetchCheckinSpots,
  fetchContentBlocks,
  fetchCouponProducts,
  fetchFieldCatalog,
  fetchMapConfig,
  fetchMapPlan,
  fetchMapPois,
  fetchMapRoutes,
  fetchMemberProfileTags,
  fetchOrders,
  fetchPersonaTagPreview,
  fetchTicketProducts,
  fetchVirtualQueueCatalog,
} from "@/api/business";
import { fetchStars } from "@/api/quiz";
import ScenicPickerSheet from "@/components/scenic/ScenicPickerSheet.vue";
import { useAuthStore } from "@/store/authStore";
import { useScenicStore } from "@/store/scenicStore";
import { DEMO_PERSONA_OPTIONS } from "@/utils/demoRuleContext";
import type { ScenicProfile } from "@/types";
import { flattenProfileTags } from "@/utils/profileTags";

type CellValue = string | number | boolean | null | undefined;

interface DataColumn {
  key: string;
  label: string;
  width?: string;
}

interface DataModule {
  id: string;
  title: string;
  contract: string;
  landingNote: string;
  /** 是否按 X-Scenic-Id 过滤（契约侧） */
  scenicScoped: boolean;
  columns: DataColumn[];
  rows: Record<string, CellValue>[];
  error?: string;
  loading?: boolean;
}

const scenicStore = useScenicStore();
const authStore = useAuthStore();

const scenicPickerVisible = ref(false);
const loading = ref(false);
const modules = ref<DataModule[]>([]);
/** 展开的模块 id；默认空 = 全部收起 */
const openModuleIds = ref<string[]>([]);

const filterScenicId = computed(
  () => scenicStore.currentScenicId ?? scenicStore.enabledScenics[0]?.scenicId ?? null,
);

const filterScenicName = computed(
  () =>
    scenicStore.currentScenicName ||
    scenicStore.enabledScenics.find((s) => s.scenicId === filterScenicId.value)?.name ||
    "未选景区",
);

const filterCityName = computed(() => {
  const scenic = scenicStore.enabledScenics.find(
    (s) => s.scenicId === filterScenicId.value,
  );
  if (!scenic) return scenicStore.currentCityName || "";
  return (
    scenicStore.enabledCities.find((c) => c.cityId === scenic.cityId)?.name || ""
  );
});

const personaLabel = computed(() => {
  const id = authStore.personaId;
  if (!id) return "未登录";
  return DEMO_PERSONA_OPTIONS.find((item) => item.value === id)?.label ?? id;
});

function cellText(value: CellValue): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "是" : "否";
  return String(value);
}

function moduleTitle(mod: DataModule): string {
  if (mod.error) return `${mod.title}（加载失败）`;
  return `${mod.title}（${mod.rows.length}）`;
}

function stringifyList(value: unknown): string {
  if (!Array.isArray(value) || !value.length) return "—";
  return value.map((item) => String(item)).join("、");
}

function assertApiPayload(
  res: { data?: unknown },
  label: string,
): asserts res is {
  data: { code?: number; data?: unknown; message?: string };
} {
  const body = res.data;
  if (typeof body !== "object" || body === null || !("code" in body)) {
    throw new Error(
      `${label}：接口未返回 JSON（Mock 可能未生效，请重启 npm run dev 后点刷新）`,
    );
  }
}

function onScenicPicked(scenicId: string) {
  scenicStore.selectScenic(scenicId);
  scenicPickerVisible.value = false;
}

async function ensureScenicSelected() {
  if (!scenicStore.loaded) scenicStore.loadCatalog();
  if (!filterScenicId.value && scenicStore.enabledScenics[0]) {
    scenicStore.selectScenic(scenicStore.enabledScenics[0].scenicId, {
      persist: false,
    });
  }
}

function scenicRows(): Record<string, CellValue>[] {
  return scenicStore.enabledScenics.map((s: ScenicProfile) => ({
    scenicId: s.scenicId,
    name: s.name,
    cityId: s.cityId,
    enabled: s.enabled !== false,
    openTime: s.openTime,
    address: s.address,
    selected: s.scenicId === filterScenicId.value,
  }));
}

async function loadModules() {
  await ensureScenicSelected();
  loading.value = true;

  const next: DataModule[] = [];

  next.push({
    id: "scenic",
    title: "景区与城市",
    contract: "本地 scenicStore（Mock：scenic/list.json · cities.json）",
    landingNote: "落地：景区主数据 / 多园区配置中心",
    scenicScoped: false,
    columns: [
      { key: "scenicId", label: "scenicId" },
      { key: "name", label: "名称" },
      { key: "cityId", label: "cityId" },
      { key: "enabled", label: "启用" },
      { key: "openTime", label: "开放时间" },
      { key: "address", label: "地址" },
      { key: "selected", label: "当前筛选" },
    ],
    rows: scenicRows(),
  });

  const pushModule = (mod: DataModule) => {
    next.push(mod);
  };

  const loadOne = async (
    partial: Omit<DataModule, "rows" | "error" | "loading">,
    loader: () => Promise<Record<string, CellValue>[]>,
  ) => {
    try {
      const rows = await loader();
      pushModule({ ...partial, rows });
    } catch (e) {
      pushModule({
        ...partial,
        rows: [],
        error: e instanceof Error ? e.message : "加载失败",
      });
    }
  };

  await loadOne(
    {
      id: "activities",
      title: "园区项目",
      contract: "GET /api/activities · Header X-Scenic-Id",
      landingNote: "落地：项目 / 游乐设施主数据（排队、场次等）",
      scenicScoped: true,
      columns: [
        { key: "activityId", label: "activityId" },
        { key: "name", label: "名称" },
        { key: "category", label: "分类" },
        { key: "location", label: "位置" },
        { key: "mapPoiId", label: "mapPoiId" },
        { key: "quizId", label: "quizId" },
        { key: "tags", label: "标签" },
        { key: "queueStatus", label: "排队状态" },
        { key: "waitMinutes", label: "等待(分)" },
        { key: "isHot", label: "热门" },
        { key: "scenicId", label: "scenicId" },
      ],
    },
    async () => {
      const res = await fetchActivities();
      assertApiPayload(res, "园区项目");
      const list = res.data?.data ?? [];
      return list.map((a) => ({
        activityId: a.activityId,
        name: a.name,
        category: a.category,
        location: a.location,
        mapPoiId: a.mapPoiId,
        quizId: a.quizId || "—",
        tags: stringifyList(a.tags),
        queueStatus: a.queueStatus,
        waitMinutes: a.waitMinutes,
        isHot: a.isHot,
        scenicId: a.scenicId,
      }));
    },
  );

  await loadOne(
    {
      id: "scenic_stars",
      title: "海洋明星",
      contract: "GET /api/stars · Header X-Scenic-Id",
      landingNote: "落地：明星介绍 + quizId 答题绑定；演示景区主要为 scenic_hy",
      scenicScoped: true,
      columns: [
        { key: "starId", label: "starId" },
        { key: "name", label: "名称" },
        { key: "species", label: "物种" },
        { key: "quizId", label: "quizId" },
        { key: "location", label: "位置" },
        { key: "aliases", label: "别名" },
        { key: "scenicId", label: "scenicId" },
      ],
    },
    async () => {
      const res = await fetchStars();
      const list = res.data?.data ?? [];
      const scenicId = filterScenicId.value;
      const scoped = scenicId
        ? list.filter((s) => s.scenicId === scenicId)
        : list;
      return scoped.map((s) => ({
        starId: s.starId,
        name: s.name,
        species: s.species,
        quizId: s.quizId,
        location: s.location,
        aliases: stringifyList(s.aliases),
        scenicId: s.scenicId,
      }));
    },
  );

  await loadOne(
    {
      id: "map_config",
      title: "地图配置",
      contract: "GET /api/map/config?scenicId= · Header X-Scenic-Id",
      landingNote: "落地：景区导览底图配置（形态 A · 平面坐标）",
      scenicScoped: true,
      columns: [
        { key: "scenicId", label: "scenicId" },
        { key: "mapImageUrl", label: "底图 URL" },
        { key: "coordinateSpace", label: "坐标系" },
        { key: "enabled", label: "启用" },
      ],
    },
    async () => {
      const res = await fetchMapConfig(filterScenicId.value || undefined);
      const cfg = res.data?.data;
      if (!cfg) return [];
      return [
        {
          scenicId: cfg.scenicId,
          mapImageUrl: cfg.mapImageUrl,
          coordinateSpace: cfg.coordinateSpace,
          enabled: cfg.enabled !== false,
        },
      ];
    },
  );

  await loadOne(
    {
      id: "map_pois",
      title: "地图 POI",
      contract: "GET /api/map/pois?scenicId= · Header X-Scenic-Id",
      landingNote: "落地：导览打点（mapX/mapY 百分比，非 GPS）",
      scenicScoped: true,
      columns: [
        { key: "poiId", label: "poiId" },
        { key: "name", label: "名称" },
        { key: "activityId", label: "activityId" },
        { key: "mapX", label: "mapX" },
        { key: "mapY", label: "mapY" },
        { key: "area", label: "区域" },
        { key: "poiType", label: "类型" },
        { key: "scenicId", label: "scenicId" },
      ],
    },
    async () => {
      const res = await fetchMapPois(filterScenicId.value || undefined);
      const list = res.data?.data ?? [];
      return list.map((p) => ({
        poiId: p.poiId,
        name: p.name,
        activityId: p.activityId,
        mapX: p.mapX,
        mapY: p.mapY,
        area: p.area,
        poiType: p.poiType,
        scenicId: p.scenicId,
      }));
    },
  );

  await loadOne(
    {
      id: "map_routes",
      title: "固定游园线",
      contract: "GET /api/map/routes?scenicId= · Header X-Scenic-Id",
      landingNote:
        "落地：导览中台固定游园线（能力②）；Demo 仅契约占位，不返回真实节点序列",
      scenicScoped: true,
      columns: [
        { key: "scenicId", label: "scenicId" },
        { key: "routeId", label: "routeId" },
        { key: "name", label: "名称" },
        { key: "demoImplemented", label: "Demo 已实现" },
        { key: "nodeCount", label: "节点数" },
        { key: "note", label: "说明" },
      ],
    },
    async () => {
      const res = await fetchMapRoutes(filterScenicId.value || undefined);
      const list = res.data?.data ?? [];
      return list.map((r) => ({
        scenicId: r.scenicId,
        routeId: r.routeId,
        name: r.name,
        demoImplemented: r.demoImplemented,
        nodeCount: r.nodeCount ?? 0,
        note: r.note,
      }));
    },
  );

  await loadOne(
    {
      id: "map_plan",
      title: "线路规划（Mock）",
      contract: "GET /api/map/plan?from=&to=&scenicId= · Header X-Scenic-Id",
      landingNote:
        "落地：from/to（mapPoiId）→ 子路径；Demo supported=false，游客端「导航过去」仅 toast",
      scenicScoped: true,
      columns: [
        { key: "scenicId", label: "scenicId" },
        { key: "from", label: "from" },
        { key: "to", label: "to" },
        { key: "supported", label: "支持规划" },
        { key: "pathNodeIds", label: "路径节点" },
        { key: "message", label: "说明" },
      ],
    },
    async () => {
      const res = await fetchMapPlan({
        scenicId: filterScenicId.value || undefined,
        from: "poi_demo_from",
        to: "poi_demo_to",
      });
      const plan = res.data?.data;
      if (!plan) return [];
      return [
        {
          scenicId: plan.scenicId,
          from: plan.from || "—",
          to: plan.to || "—",
          supported: plan.supported,
          pathNodeIds: stringifyList(plan.pathNodeIds),
          message: plan.message,
        },
      ];
    },
  );

  await loadOne(
    {
      id: "tickets",
      title: "票商品",
      contract: "GET /api/products/tickets · Header X-Scenic-Id",
      landingNote: "落地：票务商品中心（AI 推荐库可映射）",
      scenicScoped: true,
      columns: [
        { key: "productId", label: "productId" },
        { key: "name", label: "名称" },
        { key: "price", label: "价格" },
        { key: "ticketTypeId", label: "票种" },
        { key: "tags", label: "标签" },
        { key: "status", label: "状态" },
        { key: "scenicId", label: "scenicId" },
      ],
    },
    async () => {
      const res = await fetchTicketProducts();
      const list = res.data?.data ?? [];
      return list.map((p) => ({
        productId: p.productId,
        name: p.name,
        price: p.price,
        ticketTypeId: p.ticketTypeId,
        tags: stringifyList(p.tags),
        status: p.status,
        scenicId: p.scenicId,
      }));
    },
  );

  await loadOne(
    {
      id: "coupon_products",
      title: "券商品",
      contract: "GET /api/products/coupons · Header X-Scenic-Id",
      landingNote: "落地：营销券产品中心（无 scenic 视为集团通用）",
      scenicScoped: true,
      columns: [
        { key: "productId", label: "productId" },
        { key: "name", label: "名称" },
        { key: "couponType", label: "类型" },
        { key: "value", label: "面额" },
        { key: "condition", label: "条件" },
        { key: "tags", label: "标签" },
        { key: "scenicId", label: "scenicId" },
      ],
    },
    async () => {
      const res = await fetchCouponProducts();
      const list = res.data?.data ?? [];
      return list.map((p) => ({
        productId: String(p.productId ?? ""),
        name: String(p.name ?? ""),
        couponType: String(p.couponType ?? p.type ?? ""),
        value: p.value as CellValue,
        condition: (p.condition as CellValue) ?? "",
        tags: stringifyList(p.tags),
        scenicId: (p.scenicId as CellValue) ?? "（集团通用）",
      }));
    },
  );

  await loadOne(
    {
      id: "content",
      title: "内容块",
      contract: "GET /api/content/blocks · Header X-Scenic-Id",
      landingNote: "落地：内容中心（交通 / 入园须知 / 攻略文案）",
      scenicScoped: true,
      columns: [
        { key: "contentId", label: "contentId" },
        { key: "type", label: "类型" },
        { key: "title", label: "标题" },
        { key: "body", label: "正文摘要" },
        { key: "scenicId", label: "scenicId" },
      ],
    },
    async () => {
      const res = await fetchContentBlocks();
      const list = res.data?.data ?? [];
      return list.map((b) => ({
        contentId: b.contentId,
        type: b.type,
        title: b.title,
        body: b.body.length > 48 ? `${b.body.slice(0, 48)}…` : b.body,
        scenicId: b.scenicId,
      }));
    },
  );

  await loadOne(
    {
      id: "orders",
      title: "用户快照 · 订单",
      contract: "GET /api/order/list · Header Authorization + X-Scenic-Id",
      landingNote: "落地：订单中心；当前按登录 Persona + 景区过滤",
      scenicScoped: true,
      columns: [
        { key: "orderId", label: "orderId" },
        { key: "ticketName", label: "票名" },
        { key: "quantity", label: "人数" },
        { key: "totalAmount", label: "金额" },
        { key: "status", label: "状态" },
        { key: "visitDate", label: "出行日" },
        { key: "source", label: "来源" },
        { key: "scenicId", label: "scenicId" },
      ],
    },
    async () => {
      if (!authStore.personaId) {
        throw new Error("未登录，无法拉取订单（请先用演示账号登录）");
      }
      const res = await fetchOrders();
      const list = res.data?.data ?? [];
      return list.map((o) => ({
        orderId: o.orderId,
        ticketName: o.ticketName,
        quantity: `${o.quantity.adult}大${o.quantity.child}小`,
        totalAmount: o.totalAmount,
        status: o.status,
        visitDate: o.visitDate,
        source: o.source,
        scenicId: o.scenicId,
      }));
    },
  );

  await loadOne(
    {
      id: "tag_catalog",
      title: "标签目录",
      contract: "GET /api/admin/tag-catalog",
      landingNote: "落地：事实 / 订单 / AI 分类目录；含双写映射；全局",
      scenicScoped: false,
      columns: [
        { key: "tagId", label: "tagId" },
        { key: "name", label: "名称" },
        { key: "category", label: "分类" },
        { key: "defaultConfidence", label: "默认置信度" },
        { key: "dualWriteAs", label: "双写为" },
        { key: "legacyAlias", label: "兼容别名" },
        { key: "description", label: "说明" },
      ],
    },
    async () => {
      const res = await fetchAdminTagCatalog();
      const list = res.data?.data ?? [];
      return list.map((t) => ({
        tagId: t.tagId,
        name: t.name,
        category: t.category,
        defaultConfidence: t.defaultConfidence,
        dualWriteAs: stringifyList(t.dualWriteAs),
        legacyAlias: t.legacyAlias ?? "—",
        description: t.description,
      }));
    },
  );

  await loadOne(
    {
      id: "tag_rules",
      title: "订单规则说明",
      contract: "GET /api/admin/tag-rules",
      landingNote: "落地：order_family / order_couple / order_group 若-则规则",
      scenicScoped: false,
      columns: [
        { key: "ruleId", label: "ruleId" },
        { key: "tagId", label: "tagId" },
        { key: "name", label: "名称" },
        { key: "when", label: "条件" },
        { key: "dualWriteAs", label: "双写" },
        { key: "description", label: "说明" },
      ],
    },
    async () => {
      const res = await fetchAdminTagRules();
      const list = res.data?.data ?? [];
      return list.map((r) => ({
        ruleId: r.ruleId,
        tagId: r.tagId,
        name: r.name,
        when: r.when,
        dualWriteAs: stringifyList(r.dualWriteAs),
        description: r.description,
      }));
    },
  );

  await loadOne(
    {
      id: "persona_preview",
      title: "Persona 预览",
      contract: "GET /api/admin/persona-preview?personaId=",
      landingNote: "落地：三套演示身份分层标签 + 订单规则命中摘要",
      scenicScoped: false,
      columns: [
        { key: "personaId", label: "personaId" },
        { key: "nickname", label: "昵称" },
        { key: "memberLevel", label: "等级" },
        { key: "inPark", label: "在园" },
        { key: "currentLocation", label: "位置" },
        { key: "ruleTagIds", label: "规则标签" },
        { key: "memberTags", label: "事实" },
        { key: "orderTags", label: "订单" },
        { key: "aiTags", label: "AI 预置" },
        { key: "orderHits", label: "规则命中" },
      ],
    },
    async () => {
      const ids = DEMO_PERSONA_OPTIONS.map((p) => p.value);
      const rows: Record<string, CellValue>[] = [];
      for (const personaId of ids) {
        const res = await fetchPersonaTagPreview(personaId);
        const data = res.data?.data;
        if (!data) continue;
        const p = data.profile;
        rows.push({
          personaId: data.personaId,
          nickname: data.nickname,
          memberLevel: data.memberLevel,
          inPark: data.inPark,
          currentLocation: data.currentLocation || "—",
          ruleTagIds: stringifyList(p.ruleTagIds),
          memberTags: stringifyList(p.memberTags.map((t) => t.name)),
          orderTags: stringifyList(p.orderTags.map((t) => t.name)),
          aiTags: stringifyList(p.aiTags.map((t) => t.name)),
          orderHits: stringifyList(
            data.orderRuleHits.map((h) => `${h.tagId}@${h.orderId}`),
          ),
        });
      }
      return rows;
    },
  );

  await loadOne(
    {
      id: "member_profile_tags",
      title: "会员分层标签",
      contract: "GET /api/member/profile-tags · Header Authorization",
      landingNote: "落地：当前登录 Persona 的事实/订单/AI 分层标签（与助手一致）",
      scenicScoped: true,
      columns: [
        { key: "category", label: "分类" },
        { key: "tagId", label: "tagId" },
        { key: "name", label: "名称" },
        { key: "source", label: "来源" },
        { key: "confidence", label: "置信度" },
        { key: "evidence", label: "证据" },
      ],
    },
    async () => {
      if (!authStore.personaId) {
        throw new Error("未登录，无法拉取会员分层标签");
      }
      const res = await fetchMemberProfileTags();
      const profile = res.data?.data;
      if (!profile) return [];
      return flattenProfileTags(profile).map((t) => ({
        category: t.category,
        tagId: t.tagId,
        name: t.name,
        source: t.source,
        confidence: t.confidence,
        evidence: t.evidence || "—",
      }));
    },
  );

  await loadOne(
    {
      id: "field_catalog",
      title: "规则字段目录",
      contract: "GET /api/admin/field-catalog",
      landingNote: "落地：运营规则可用字段注册表；全局",
      scenicScoped: false,
      columns: [
        { key: "fieldId", label: "fieldId" },
        { key: "label", label: "名称" },
        { key: "valueType", label: "类型" },
        { key: "group", label: "分组" },
        { key: "ruleEligible", label: "可用于规则" },
        { key: "source", label: "来源" },
      ],
    },
    async () => {
      const res = await fetchFieldCatalog();
      const fields = res.data?.data?.fields ?? [];
      return fields.map((f) => ({
        fieldId: f.fieldId,
        label: f.label,
        valueType: f.valueType,
        group: f.group,
        ruleEligible: f.ruleEligible,
        source: f.source,
      }));
    },
  );

  await loadOne(
    {
      id: "skills",
      title: "Skill 配置（只读）",
      contract: "GET /api/assistant/skills",
      landingNote: "落地：助手能力清单；编辑请到「业务场景」Tab",
      scenicScoped: false,
      columns: [
        { key: "skillId", label: "skillId" },
        { key: "name", label: "名称" },
        { key: "enabled", label: "启用" },
        { key: "tools", label: "Tools" },
        { key: "keywords", label: "触发词数" },
      ],
    },
    async () => {
      const res = await fetchAssistantSkills();
      const list = res.data?.data ?? [];
      return list.map((s) => ({
        skillId: s.skillId,
        name: s.name,
        enabled: s.enabled,
        tools: stringifyList(s.tools),
        keywords: s.triggerKeywords?.length ?? 0,
      }));
    },
  );

  await loadOne(
    {
      id: "checkin",
      title: "打卡点",
      contract: "GET /api/checkin/spots · Header Authorization + X-Scenic-Id",
      landingNote: "落地：园内打卡 / 导览点位",
      scenicScoped: true,
      columns: [
        { key: "spotId", label: "spotId" },
        { key: "name", label: "名称" },
        { key: "location", label: "位置" },
        { key: "activityId", label: "activityId" },
        { key: "rewardPoints", label: "积分" },
        { key: "scenicId", label: "scenicId" },
      ],
    },
    async () => {
      if (!authStore.personaId) {
        throw new Error("未登录，无法拉取打卡点");
      }
      const res = await fetchCheckinSpots();
      const spots = res.data?.data?.spots ?? [];
      return spots.map((s) => ({
        spotId: s.spotId,
        name: s.name,
        location: s.location,
        activityId: s.activityId,
        rewardPoints: s.rewardPoints,
        scenicId: s.scenicId,
      }));
    },
  );

  await loadOne(
    {
      id: "virtual_queue",
      title: "虚拟排队目录",
      contract: "GET /api/virtual-queue/catalog · Header Authorization + X-Scenic-Id",
      landingNote: "落地：虚拟排队可取号项目",
      scenicScoped: true,
      columns: [
        { key: "activityId", label: "activityId" },
        { key: "name", label: "名称" },
        { key: "isFree", label: "免费" },
        { key: "queuePrice", label: "价格" },
        { key: "waitMinutes", label: "等待(分)" },
        { key: "scenicId", label: "scenicId" },
      ],
    },
    async () => {
      if (!authStore.personaId) {
        throw new Error("未登录，无法拉取虚拟排队目录");
      }
      const res = await fetchVirtualQueueCatalog();
      const items = res.data?.data?.activities ?? [];
      return items.map((item) => ({
        activityId: item.activityId,
        name: item.name,
        isFree: item.virtualQueue?.isFree,
        queuePrice: item.virtualQueue?.queuePrice,
        waitMinutes: item.waitMinutes,
        scenicId: item.scenicId,
      }));
    },
  );

  modules.value = next;
  loading.value = false;
}

let pageReady = false;

watch(filterScenicId, () => {
  if (!pageReady) return;
  void loadModules();
});

onMounted(async () => {
  await ensureScenicSelected();
  await loadModules();
  pageReady = true;
});
</script>

<template>
  <div class="admin-data">
    <van-notice-bar
      left-icon="info-o"
      text="只读查看 Mock 与接口契约。若多数模块为 0 且提示未返回 JSON，请重启 npm run dev 后再点刷新。订单/会员标签依赖当前登录演示账号。"
    />

    <section class="admin-data__filter">
      <van-cell
        title="筛选景区"
        :value="filterScenicName"
        is-link
        :label="
          [filterCityName, filterScenicId].filter(Boolean).join(' · ') || '未选择'
        "
        @click="scenicPickerVisible = true"
      />
      <van-cell
        title="当前 Persona"
        :value="personaLabel"
        :label="authStore.personaId || '未登录时订单/会员标签模块会提示错误'"
      />
      <div class="admin-data__filter-actions">
        <van-button size="small" type="primary" :loading="loading" @click="loadModules">
          刷新
        </van-button>
      </div>
    </section>

    <van-collapse v-model="openModuleIds" class="admin-data__collapse">
      <van-collapse-item
        v-for="mod in modules"
        :id="`data-mod-${mod.id}`"
        :key="mod.id"
        :name="mod.id"
        :title="moduleTitle(mod)"
        :label="mod.contract"
      >
        <div class="admin-data__module-body">
          <p class="admin-data__contract">
            <span
              class="admin-data__badge"
              :class="mod.scenicScoped ? 'is-scoped' : 'is-global'"
            >
              {{ mod.scenicScoped ? "按景区" : "全局" }}
            </span>
            {{ mod.contract }}
          </p>
          <p class="admin-data__landing">{{ mod.landingNote }}</p>
          <p v-if="mod.error" class="admin-data__error">{{ mod.error }}</p>
          <div v-else class="admin-data__table-wrap">
            <table class="admin-data__table">
              <thead>
                <tr>
                  <th v-for="col in mod.columns" :key="col.key">{{ col.label }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="!mod.rows.length">
                  <td :colspan="mod.columns.length" class="admin-data__empty">
                    暂无数据
                  </td>
                </tr>
                <tr v-for="(row, idx) in mod.rows" :key="`${mod.id}-${idx}`">
                  <td v-for="col in mod.columns" :key="col.key">
                    {{ cellText(row[col.key]) }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p v-if="!mod.error" class="admin-data__count">共 {{ mod.rows.length }} 条</p>
        </div>
      </van-collapse-item>
    </van-collapse>

    <ScenicPickerSheet
      v-model:show="scenicPickerVisible"
      :cities="scenicStore.enabledCities"
      :scenics="scenicStore.enabledScenics"
      :current-scenic-id="filterScenicId"
      :initial-city-id="scenicStore.resolvePickerCityId(filterScenicId)"
      title="选择筛选景区"
      @select="onScenicPicked"
      @update:city-id="(cityId) => scenicStore.selectCity(cityId)"
    />
  </div>
</template>

<style scoped>
.admin-data {
  min-height: 100%;
  padding: 0 12px 40px;
  background: #f5f6f8;
}

.admin-data__filter {
  margin: 12px 0;
  border-radius: 10px;
  overflow: hidden;
  background: #fff;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
}

.admin-data__filter-actions {
  display: flex;
  justify-content: flex-end;
  padding: 8px 12px 12px;
}

.admin-data__collapse {
  margin-bottom: 16px;
}

.admin-data__collapse :deep(.van-collapse-item) {
  margin-bottom: 10px;
  overflow: hidden;
  border-radius: 10px;
  background: #fff;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
}

.admin-data__collapse :deep(.van-collapse-item__title) {
  font-weight: 600;
  color: #1a1a1a;
}

.admin-data__collapse :deep(.van-collapse-item__label) {
  margin-top: 2px;
  font-size: 11px;
  color: #969799;
  line-height: 1.35;
  word-break: break-all;
}

.admin-data__collapse :deep(.van-collapse-item__content) {
  padding: 0 12px 12px;
  color: inherit;
}

.admin-data__module-body {
  padding-top: 4px;
}

.admin-data__contract {
  margin: 0 0 4px;
  font-size: 12px;
  color: #646566;
  line-height: 1.5;
  word-break: break-all;
}

.admin-data__landing {
  margin: 0 0 10px;
  font-size: 12px;
  color: #969799;
  line-height: 1.4;
}

.admin-data__badge {
  display: inline-block;
  margin-right: 6px;
  padding: 1px 6px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
  vertical-align: 1px;
}

.admin-data__badge.is-scoped {
  color: #07c160;
  background: #e8f8ef;
}

.admin-data__badge.is-global {
  color: #576b95;
  background: #eef2ff;
}

.admin-data__error {
  margin: 0;
  padding: 10px 12px;
  border-radius: 6px;
  background: #fff7e8;
  color: #ed6a0c;
  font-size: 13px;
}

.admin-data__table-wrap {
  width: 100%;
  overflow-x: auto;
  border: 1px solid #ebedf0;
  border-radius: 6px;
}

.admin-data__table {
  width: 100%;
  min-width: 560px;
  border-collapse: collapse;
  font-size: 12px;
  line-height: 1.4;
}

.admin-data__table th,
.admin-data__table td {
  padding: 8px 10px;
  border-bottom: 1px solid #f0f0f0;
  text-align: left;
  vertical-align: top;
  white-space: nowrap;
  max-width: 220px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.admin-data__table th {
  background: #f7f8fa;
  color: #646566;
  font-weight: 600;
  position: sticky;
  top: 0;
}

.admin-data__table tbody tr:last-child td {
  border-bottom: none;
}

.admin-data__empty {
  color: #969799;
  text-align: center !important;
  white-space: normal !important;
}

.admin-data__count {
  margin: 8px 0 0;
  font-size: 12px;
  color: #969799;
  text-align: right;
}
</style>
