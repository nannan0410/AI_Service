<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { showToast } from "vant";
import ChatCardShell from "./ChatCardShell.vue";
import { downloadGuideCardImage } from "@/utils/saveGuideImage";
import { fetchMapConfig } from "@/api/business";
import { useScenicStore } from "@/store/scenicStore";
import { hasMapGuideForScenic, buildMapDeepLink } from "@/utils/mapGuide";
import { DEFAULT_SCENIC_ID } from "@/utils/scenicScope";
import type { TravelGuidePayload } from "@/types";
import {
  ACTIVITY_CATEGORY_LABELS,
  formatHotProjectLine,
  formatQueueLine,
} from "@/utils/activityDisplay";
import { useAssistantStore } from "@/store/assistantStore";
import { filterExplainReason } from "@/utils/explainReasons";

const props = defineProps<{ payload: TravelGuidePayload; embedded?: boolean }>();

function queueLine(item: TravelGuidePayload["activities"][number]) {
  return formatQueueLine(item, {
    respectGuideContext: Boolean(item.guideContext),
  });
}

const router = useRouter();
const scenicStore = useScenicStore();
const assistantStore = useAssistantStore();
const showExplainReasons = computed(
  () => assistantStore.uiConfig.showExplainReasons !== false,
);

function activityReason(item: TravelGuidePayload["activities"][number]) {
  return filterExplainReason(item.reason, showExplainReasons.value);
}

const captureRef = ref<HTMLElement | null>(null);
const saving = ref(false);
const showOpenMap = ref(false);
const embedded = computed(() => props.embedded === true);

const isInParkGuide = computed(() => props.payload.scope === "in_park");

const scopeLabels = computed(() => {
  const scope = props.payload.scope ?? "recommend";
  const labels: string[] = [];
  if (scope === "full") {
    labels.push("含交通", "含入园", "推荐项目");
  } else if (scope === "in_park") {
    labels.push("游玩线路", "游玩建议");
  } else {
    labels.push("推荐项目");
  }
  return labels;
});

const activitiesSectionTitle = computed(() =>
  isInParkGuide.value ? "线路途经" : "推荐项目",
);

/** 园内路线：按途经顺序收集可打点的 mapPoiId */
const routePoiIds = computed(() => {
  const ids: string[] = [];
  for (const item of props.payload.activities ?? []) {
    const poiId = item.mapPoiId?.trim();
    if (poiId && !ids.includes(poiId)) ids.push(poiId);
  }
  return ids;
});

async function resolveMapAvailability() {
  const scenicId = scenicStore.currentScenicId || DEFAULT_SCENIC_ID;
  try {
    const { data: res } = await fetchMapConfig(scenicId);
    showOpenMap.value =
      res.code === 200 && hasMapGuideForScenic(res.data ?? null);
  } catch {
    showOpenMap.value = false;
  }
}

async function onSaveGuide() {
  const el = captureRef.value;
  if (!el || saving.value) return;

  saving.value = true;
  try {
    await downloadGuideCardImage(el, props.payload);
    showToast("攻略图已生成，请保存到本地");
  } catch {
    showToast("生成攻略图失败，请重试");
  } finally {
    saving.value = false;
  }
}

function onOpenMap() {
  const scenicId = scenicStore.currentScenicId || DEFAULT_SCENIC_ID;
  // 园内今日路线：多点高亮 + 序号；其它攻略仍只进景区地图
  if (isInParkGuide.value && routePoiIds.value.length) {
    void router.push(
      buildMapDeepLink({ scenicId, poiIds: routePoiIds.value }),
    );
    return;
  }
  void router.push({ path: "/map", query: { scenicId } });
}

watch(
  () => scenicStore.currentScenicId,
  () => {
    void resolveMapAvailability();
  },
);

onMounted(() => {
  void resolveMapAvailability();
});
</script>

<template>
  <div class="guide-card" :class="{ 'guide-card--embedded': embedded }">
    <div ref="captureRef" class="guide-card__capture">
      <ChatCardShell :title="payload.title" tag="攻略" tag-color="#1989fa">
        <p v-if="payload.visitDate || payload.ticketName" class="guide-card__meta">
          <template v-if="payload.ticketName">{{ payload.ticketName }}</template>
          <template v-if="payload.visitDate"> · 计划 {{ payload.visitDate }} 出行</template>
        </p>

        <div v-if="scopeLabels.length" class="guide-card__tags">
          <span
            v-for="label in scopeLabels"
            :key="label"
            class="guide-card__tag"
          >
            {{ label }}
          </span>
        </div>

        <section v-if="payload.traffic" class="guide-card__section">
          <h4 class="guide-card__section-title">🚇 {{ payload.traffic.title }}</h4>
          <p class="guide-card__section-body">{{ payload.traffic.body }}</p>
        </section>

        <section v-if="payload.entryNotice" class="guide-card__section">
          <h4 class="guide-card__section-title">🎫 {{ payload.entryNotice.title }}</h4>
          <p class="guide-card__section-body">{{ payload.entryNotice.body }}</p>
        </section>

        <section v-if="payload.dayPlan" class="guide-card__section">
          <h4 class="guide-card__section-title">
            {{ isInParkGuide ? "🗺" : "📋" }} {{ payload.dayPlan.title }}
          </h4>
          <p class="guide-card__section-body">{{ payload.dayPlan.body }}</p>
        </section>

        <section v-if="payload.tips" class="guide-card__section">
          <h4 class="guide-card__section-title">💡 {{ payload.tips.title }}</h4>
          <p class="guide-card__section-body">{{ payload.tips.body }}</p>
        </section>

        <section
          v-if="payload.activities.length"
          class="guide-card__section"
          :class="{ 'guide-card__section--compact': isInParkGuide }"
        >
          <h4 class="guide-card__section-title">
            🎡 {{ activitiesSectionTitle }}
          </h4>
          <ul class="guide-card__activities">
            <li
              v-for="(item, index) in payload.activities"
              :key="item.activityId"
            >
              <strong>
                <template v-if="isInParkGuide">{{ index + 1 }}. </template>
                {{ item.name }}
                <span v-if="item.isHot" class="guide-card__act-hot">热门</span>
              </strong>
              <span v-if="item.category" class="guide-card__act-type">
                {{ ACTIVITY_CATEGORY_LABELS[item.category] }}
              </span>
              <span>{{ item.location }} · {{ item.timeRange }}</span>
              <span
                v-if="item.showStartTimes?.length"
                class="guide-card__act-show"
              >
                场次 {{ item.showStartTimes.join(" / ") }}
              </span>
              <span v-if="queueLine(item)" class="guide-card__act-queue">
                {{ queueLine(item) }}
              </span>
              <span
                v-if="!isInParkGuide && formatHotProjectLine(item)"
                class="guide-card__act-hot-tip"
              >
                {{ formatHotProjectLine(item) }}
              </span>
              <span
                v-if="!isInParkGuide && item.recommendedDuration"
                class="guide-card__act-dur"
              >
                建议 {{ item.recommendedDuration }}
              </span>
              <em v-if="!isInParkGuide && activityReason(item)">{{
                activityReason(item)
              }}</em>
            </li>
          </ul>
        </section>
      </ChatCardShell>
    </div>

    <div
      class="guide-card__actions"
      :class="{ 'guide-card__actions--single': !showOpenMap }"
    >
      <van-button
        type="primary"
        size="small"
        round
        plain
        class="guide-card__save"
        :class="{ 'guide-card__save--full': !showOpenMap }"
        :block="!showOpenMap"
        :loading="saving"
        :disabled="saving"
        @click="onSaveGuide"
      >
        保存攻略图片到本地
      </van-button>
      <van-button
        v-if="showOpenMap"
        type="primary"
        size="small"
        round
        plain
        class="guide-card__map"
        @click="onOpenMap"
      >
        打开地图
      </van-button>
    </div>
  </div>
</template>

<style scoped>
.guide-card {
  width: 100%;
  max-width: 280px;
}

.guide-card--embedded {
  max-width: none;
}

.guide-card--embedded :deep(.chat-card) {
  max-width: none;
  background: #f7f8fa;
  box-shadow: none;
  padding: 10px;
}

.guide-card__capture {
  width: 100%;
}

.guide-card__meta {
  margin: 0 0 8px;
  font-size: 12px;
  color: #969799;
}

.guide-card__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 10px;
}

.guide-card__tag {
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 10px;
  color: #1989fa;
  background: rgba(25, 137, 250, 0.08);
}

.guide-card__section {
  margin-top: 10px;
}

.guide-card__section--compact .guide-card__activities li {
  padding: 6px 0;
}

.guide-card__section--compact .guide-card__activities strong {
  font-size: 12px;
}

.guide-card__section-title {
  margin: 0 0 4px;
  font-size: 13px;
  font-weight: 600;
  color: #323233;
}

.guide-card__section-body {
  margin: 0;
  font-size: 12px;
  color: #646566;
  line-height: 1.5;
  white-space: pre-wrap;
}

.guide-card__activities {
  margin: 0;
  padding: 0;
  list-style: none;
}

.guide-card__activities li {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 8px 0;
  border-bottom: 1px solid #ebedf0;
  font-size: 12px;
  color: #646566;
}

.guide-card__activities li:last-child {
  border-bottom: none;
  padding-bottom: 0;
}

.guide-card__activities strong {
  color: #323233;
  font-size: 13px;
}

.guide-card__act-type {
  margin-right: 4px;
  font-size: 10px;
  color: #1989fa;
}

.guide-card__act-show {
  color: #1989fa;
  font-size: 11px;
}

.guide-card__act-queue {
  color: #ed6a0c;
  font-size: 11px;
}

.guide-card__act-hot {
  margin-left: 6px;
  padding: 1px 6px;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 500;
  color: #ee0a24;
  background: rgba(238, 10, 36, 0.08);
}

.guide-card__act-hot-tip {
  color: #ee0a24;
  font-size: 11px;
}

.guide-card__act-dur {
  color: #969799;
  font-size: 11px;
}

.guide-card__activities em {
  font-style: normal;
  color: var(--chat-primary);
  font-size: 11px;
}

.guide-card__actions {
  display: flex;
  gap: 8px;
  margin-top: 8px;
  width: 100%;
}

.guide-card__actions--single {
  display: block;
}

.guide-card__save {
  flex: 1;
  min-width: 0;
  margin-top: 0;
  color: var(--chat-primary);
  border-color: var(--chat-primary);
}

.guide-card__save--full {
  width: 100%;
}

.guide-card__map {
  flex: 0 0 auto;
  margin-top: 0;
  padding: 0 14px;
  color: var(--chat-primary);
  border-color: var(--chat-primary);
}
</style>
