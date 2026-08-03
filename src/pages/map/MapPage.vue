<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { showToast } from "vant";
import { fetchActivities, fetchMapConfig, fetchMapPois } from "@/api/business";
import { useScenicStore } from "@/store/scenicStore";
import {
  findPoiById,
  hasMapGuideForScenic,
  parseRoutePoiIdsQuery,
} from "@/utils/mapGuide";
import { QUEUE_STATUS_LABELS } from "@/utils/activityDisplay";
import { DEFAULT_SCENIC_ID } from "@/utils/scenicScope";
import { withBaseUrl } from "@/utils/publicUrl";
import type { Activity, MapConfig, MapPoi } from "@/types";

const route = useRoute();
const router = useRouter();
const scenicStore = useScenicStore();

const loading = ref(true);
const config = ref<MapConfig | null>(null);
const pois = ref<MapPoi[]>([]);
const activities = ref<Activity[]>([]);
const selectedPoiId = ref<string | null>(null);
const showDetail = ref(false);
const mapImageFailed = ref(false);

const scenicId = computed(() => {
  const q = route.query.scenicId;
  if (typeof q === "string" && q) return q;
  return scenicStore.currentScenicId || DEFAULT_SCENIC_ID;
});

const scenicName = computed(() => {
  const hit = scenicStore.enabledScenics.find((s) => s.scenicId === scenicId.value);
  return hit?.name || "园区地图";
});

const mapImageUrl = computed(() => {
  const url = config.value?.mapImageUrl?.trim();
  if (!url) return "";
  const resolved = withBaseUrl(url);
  // 避免缓存旧坏图；占位图可带版本参数
  if (url.startsWith("/map/") || resolved.includes("/map/")) {
    return `${resolved}${resolved.includes("?") ? "&" : "?"}v=2`;
  }
  return resolved;
});

/** 今日路线等：有序高亮 poiId → 序号（1-based） */
const routeOrderByPoiId = computed(() => {
  const ordered = parseRoutePoiIdsQuery(route.query.poiIds);
  const map = new Map<string, number>();
  ordered.forEach((id, index) => {
    if (!map.has(id)) map.set(id, index + 1);
  });
  return map;
});

const isRouteHighlightMode = computed(() => routeOrderByPoiId.value.size > 0);

const selectedPoi = computed(() =>
  findPoiById(pois.value, selectedPoiId.value || undefined),
);

const selectedActivity = computed(() => {
  const poi = selectedPoi.value;
  if (!poi?.activityId) return null;
  return activities.value.find((a) => a.activityId === poi.activityId) ?? null;
});

const hasMap = computed(() => hasMapGuideForScenic(config.value));

const selectedRouteIndex = computed(() => {
  const id = selectedPoiId.value;
  if (!id) return null;
  return routeOrderByPoiId.value.get(id) ?? null;
});

function markerStyle(poi: MapPoi) {
  return {
    left: `${poi.mapX}%`,
    top: `${poi.mapY}%`,
  };
}

function routeIndexOf(poiId: string): number | null {
  return routeOrderByPoiId.value.get(poiId) ?? null;
}

function onSelectPoi(poiId: string) {
  selectedPoiId.value = poiId;
  showDetail.value = true;
}

function closeDetail() {
  showDetail.value = false;
}

function onNavigateToast() {
  showToast("请使用景区导览 App 导航");
}

async function load() {
  loading.value = true;
  mapImageFailed.value = false;
  try {
    const sid = scenicId.value;
    const [configRes, poisRes, actRes] = await Promise.all([
      fetchMapConfig(sid),
      fetchMapPois(sid),
      fetchActivities(),
    ]);
    config.value = configRes.data?.code === 200 ? configRes.data.data : null;
    pois.value = poisRes.data?.code === 200 ? poisRes.data.data ?? [] : [];
    activities.value = actRes.data?.code === 200 ? actRes.data.data ?? [] : [];

    const routeIds = parseRoutePoiIdsQuery(route.query.poiIds);
    const qPoi = route.query.poiId;
    if (routeIds.length) {
      const first = routeIds.find((id) => pois.value.some((p) => p.poiId === id));
      selectedPoiId.value = first ?? null;
      showDetail.value = false;
    } else if (
      typeof qPoi === "string" &&
      qPoi &&
      pois.value.some((p) => p.poiId === qPoi)
    ) {
      selectedPoiId.value = qPoi;
      showDetail.value = true;
    } else {
      selectedPoiId.value = null;
      showDetail.value = false;
    }
  } finally {
    loading.value = false;
  }
}

watch(
  () => [route.query.scenicId, route.query.poiId, route.query.poiIds],
  () => {
    void load();
  },
);

onMounted(() => {
  if (!scenicStore.loaded) scenicStore.loadCatalog();
  void load();
});
</script>

<template>
  <div class="map-page">
    <van-nav-bar
      :title="isRouteHighlightMode ? `${scenicName} · 今日路线` : scenicName"
      left-arrow
      class="map-page__nav"
      @click-left="router.back()"
    />

    <div v-if="loading" class="map-page__state">加载地图中…</div>
    <div v-else-if="!hasMap" class="map-page__state">
      <p>当前景区暂未配置导览地图</p>
      <p class="map-page__hint">演示请切换至「上海奇趣乐园」</p>
      <van-button size="small" type="primary" plain @click="router.push('/chat')">
        返回对话
      </van-button>
    </div>
    <template v-else>
      <div class="map-page__canvas-wrap">
        <div
          class="map-page__canvas"
          :class="{ 'map-page__canvas--fallback': mapImageFailed }"
        >
          <img
            v-if="mapImageUrl && !mapImageFailed"
            class="map-page__bg"
            :src="mapImageUrl"
            alt="景区导览底图"
            draggable="false"
            @error="mapImageFailed = true"
          />
          <button
            v-for="poi in pois"
            :key="poi.poiId"
            type="button"
            class="map-page__marker"
            :class="{
              'is-active': poi.poiId === selectedPoiId,
              'is-route': routeIndexOf(poi.poiId) != null,
              'is-dimmed':
                isRouteHighlightMode && routeIndexOf(poi.poiId) == null,
            }"
            :style="markerStyle(poi)"
            :title="poi.name"
            @click="onSelectPoi(poi.poiId)"
          >
            <span
              v-if="routeIndexOf(poi.poiId) != null"
              class="map-page__marker-num"
            >
              {{ routeIndexOf(poi.poiId) }}
            </span>
            <span v-else class="map-page__marker-dot" />
            <span class="map-page__marker-label">{{ poi.name }}</span>
          </button>
        </div>
      </div>

      <p class="map-page__tip">
        {{
          isRouteHighlightMode
            ? "序号为今日推荐游玩顺序，点击查看项目详情"
            : "点击圆点查看项目详情与排队"
        }}
      </p>
    </template>

    <van-popup
      v-model:show="showDetail"
      position="bottom"
      round
      :style="{ maxHeight: '55%' }"
    >
      <div v-if="selectedPoi" class="map-page__detail">
        <h3 class="map-page__detail-title">
          <span
            v-if="selectedRouteIndex != null"
            class="map-page__detail-num"
          >
            {{ selectedRouteIndex }}
          </span>
          {{ selectedPoi.name }}
        </h3>
        <p v-if="selectedPoi.area" class="map-page__detail-meta">
          区域 · {{ selectedPoi.area }}
        </p>
        <template v-if="selectedActivity">
          <p class="map-page__detail-body">
            {{
              selectedActivity.description ||
              `${selectedActivity.name}，开放时间 ${selectedActivity.timeRange}。`
            }}
          </p>
          <div v-if="selectedActivity.tags?.length" class="map-page__tags">
            <span
              v-for="tag in selectedActivity.tags"
              :key="tag"
              class="map-page__tag"
            >
              {{ tag }}
            </span>
          </div>
          <p class="map-page__queue">
            排队：
            {{
              selectedActivity.queueStatus === "waiting" &&
              selectedActivity.waitMinutes != null
                ? `约 ${selectedActivity.waitMinutes} 分钟`
                : QUEUE_STATUS_LABELS[selectedActivity.queueStatus] || "—"
            }}
          </p>
          <p
            v-if="selectedActivity.showStartTimes?.length"
            class="map-page__queue"
          >
            场次 {{ selectedActivity.showStartTimes.join(" / ") }}
          </p>
        </template>
        <p v-else class="map-page__detail-body">
          设施点位，暂无关联游乐项目详情。
        </p>
        <div class="map-page__detail-actions">
          <van-button
            type="primary"
            plain
            round
            class="map-page__detail-nav"
            @click="onNavigateToast"
          >
            导航过去
          </van-button>
          <van-button
            type="primary"
            round
            class="map-page__detail-close"
            @click="closeDetail"
          >
            关闭
          </van-button>
        </div>
      </div>
    </van-popup>
  </div>
</template>

<style scoped>
.map-page {
  min-height: 100vh;
  background: #f0f3f1;
  padding-bottom: 24px;
}

.map-page__nav {
  position: sticky;
  top: 0;
  z-index: 100;
}

.map-page__state {
  padding: 48px 24px;
  text-align: center;
  color: #646566;
  font-size: 14px;
  line-height: 1.6;
}

.map-page__hint {
  margin: 8px 0 16px;
  color: #969799;
  font-size: 13px;
}

.map-page__canvas-wrap {
  margin: 12px;
  border-radius: 12px;
  overflow: hidden;
  background: #fff;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.06);
}

.map-page__canvas {
  position: relative;
  width: 100%;
  aspect-ratio: 4 / 5;
  overflow: hidden;
  background: linear-gradient(145deg, #d8f0e4 0%, #e8f5ee 55%, #cfe6f5 100%);
}

.map-page__canvas--fallback::before {
  content: "底图占位（可替换 mapImageUrl）";
  position: absolute;
  left: 50%;
  top: 12%;
  transform: translateX(-50%);
  z-index: 1;
  color: #3d6b55;
  font-size: 14px;
  font-weight: 600;
  pointer-events: none;
}

.map-page__bg {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  user-select: none;
  pointer-events: none;
}

.map-page__marker {
  position: absolute;
  transform: translate(-50%, -50%);
  border: none;
  background: transparent;
  padding: 0;
  cursor: pointer;
  z-index: 2;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.map-page__marker.is-route {
  z-index: 4;
}

.map-page__marker.is-dimmed {
  z-index: 1;
  opacity: 0.28;
}

.map-page__marker.is-dimmed .map-page__marker-label {
  display: none;
}

.map-page__marker-dot {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #07c160;
  border: 2px solid #fff;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.25);
}

.map-page__marker-num {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 24px;
  height: 24px;
  padding: 0 4px;
  border-radius: 999px;
  background: #1989fa;
  border: 2px solid #fff;
  color: #fff;
  font-size: 13px;
  font-weight: 700;
  line-height: 1;
  box-shadow: 0 2px 6px rgba(25, 137, 250, 0.45);
}

.map-page__marker.is-active .map-page__marker-dot {
  width: 18px;
  height: 18px;
  background: #ee0a24;
}

.map-page__marker.is-active .map-page__marker-num,
.map-page__marker.is-route.is-active .map-page__marker-num {
  background: #ee0a24;
  box-shadow: 0 2px 8px rgba(238, 10, 36, 0.4);
}

.map-page__marker-label {
  max-width: 72px;
  padding: 1px 4px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.92);
  color: #323233;
  font-size: 10px;
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
}

.map-page__marker.is-route .map-page__marker-label {
  font-weight: 600;
  color: #1989fa;
}

.map-page__tip {
  margin: 8px 16px 0;
  font-size: 12px;
  color: #969799;
  text-align: center;
}

.map-page__detail {
  padding: 20px 16px 24px;
}

.map-page__detail-title {
  margin: 0 0 8px;
  font-size: 18px;
  font-weight: 600;
  color: #323233;
  display: flex;
  align-items: center;
  gap: 8px;
}

.map-page__detail-num {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 22px;
  height: 22px;
  border-radius: 999px;
  background: #1989fa;
  color: #fff;
  font-size: 12px;
  font-weight: 700;
}

.map-page__detail-meta {
  margin: 0 0 10px;
  font-size: 13px;
  color: #969799;
}

.map-page__detail-body {
  margin: 0 0 10px;
  font-size: 14px;
  color: #646566;
  line-height: 1.5;
}

.map-page__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 10px;
}

.map-page__tag {
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 11px;
  color: #07c160;
  background: rgba(7, 193, 96, 0.1);
}

.map-page__queue {
  margin: 0 0 8px;
  font-size: 13px;
  color: #323233;
}

.map-page__detail-actions {
  display: flex;
  gap: 10px;
  margin-top: 16px;
}

.map-page__detail-nav,
.map-page__detail-close {
  flex: 1;
}
</style>
