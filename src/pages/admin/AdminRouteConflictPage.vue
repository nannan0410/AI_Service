<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { useBusinessConfigStore } from "@/store/businessConfigStore";
import {
  buildRouteConflictReport,
  findKeywordOverlaps,
  type RouteConflictSeverity,
} from "@/utils/intentExclusionCatalog";
import { normalizeSkillsTriggerKeywords } from "@/utils/skillKeywordValidation";
import type { AssistantSkillConfig } from "@/types";

const router = useRouter();
const businessConfigStore = useBusinessConfigStore();

const skills = ref<AssistantSkillConfig[]>([]);

onMounted(async () => {
  await businessConfigStore.ensureLoaded();
  skills.value = normalizeSkillsTriggerKeywords(
    structuredClone(businessConfigStore.skills),
  );
});

const overlaps = computed(() => findKeywordOverlaps(skills.value));
const report = computed(() => buildRouteConflictReport(skills.value));

const overlapItems = computed(() =>
  report.value.filter((i) => i.severity === "overlap" || i.severity === "covered"),
);
const ruleItems = computed(() => report.value.filter((i) => i.severity === "info"));

function severityTag(severity: RouteConflictSeverity): {
  type: "danger" | "success" | "primary";
  text: string;
} {
  if (severity === "overlap") return { type: "danger", text: "潜在冲突" };
  if (severity === "covered") return { type: "success", text: "已有排他" };
  return { type: "primary", text: "排他规则" };
}

function goBack() {
  router.push("/config/business");
}
</script>

<template>
  <div class="route-check">
    <van-notice-bar
      left-icon="info-o"
      text="演示版轻量检查：对比 Skill 触发词重叠与只读排他目录，不改运行时路由。"
    />

    <section class="route-check__summary">
      <van-cell title="已启用 Skill" :value="String(skills.filter((s) => s.enabled !== false).length)" />
      <van-cell title="重叠关键词" :value="String(overlaps.length)" />
      <van-cell
        title="未声明排他的重叠"
        :value="String(overlapItems.filter((i) => i.severity === 'overlap').length)"
      />
    </section>

    <section class="route-check__block">
      <h3 class="route-check__title">触发词重叠</h3>
      <p v-if="!overlapItems.length" class="route-check__empty">当前无多 Skill 共用触发词。</p>
      <div v-else class="route-check__list">
        <div
          v-for="item in overlapItems"
          :key="item.id"
          class="route-check__card"
        >
          <div class="route-check__card-head">
            <van-tag :type="severityTag(item.severity).type" plain>
              {{ severityTag(item.severity).text }}
            </van-tag>
            <span class="route-check__card-title">{{ item.title }}</span>
          </div>
          <p class="route-check__card-detail">{{ item.detail }}</p>
        </div>
      </div>
    </section>

    <section class="route-check__block">
      <h3 class="route-check__title">排他规则说明（只读）</h3>
      <div class="route-check__list">
        <div
          v-for="item in ruleItems"
          :key="item.id"
          class="route-check__card route-check__card--info"
        >
          <div class="route-check__card-head">
            <van-tag type="primary" plain>排他</van-tag>
            <span class="route-check__card-title">{{ item.title }}</span>
          </div>
          <p class="route-check__card-detail">{{ item.detail }}</p>
        </div>
      </div>
    </section>

    <div class="route-check__footer">
      <van-button block type="primary" plain @click="goBack">返回业务场景</van-button>
    </div>
  </div>
</template>

<style scoped>
.route-check {
  padding: 12px 12px 24px;
  background: #f5f6f8;
  min-height: 60vh;
}

.route-check__summary {
  margin-bottom: 12px;
  overflow: hidden;
  border-radius: 10px;
  background: #fff;
}

.route-check__block {
  margin-bottom: 16px;
}

.route-check__title {
  margin: 0 0 8px;
  padding: 0 4px;
  font-size: 14px;
  font-weight: 600;
  color: #323233;
}

.route-check__empty {
  margin: 0;
  padding: 16px;
  border-radius: 10px;
  background: #fff;
  color: #969799;
  font-size: 13px;
  text-align: center;
}

.route-check__list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.route-check__card {
  padding: 12px;
  border-radius: 10px;
  background: #fff;
  border: 1px solid #ebedf0;
}

.route-check__card--info {
  border-color: #e8f3ff;
  background: #f7fbff;
}

.route-check__card-head {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-bottom: 6px;
}

.route-check__card-title {
  flex: 1;
  font-size: 13px;
  font-weight: 500;
  color: #323233;
  line-height: 1.4;
}

.route-check__card-detail {
  margin: 0;
  font-size: 12px;
  color: #646566;
  line-height: 1.5;
}

.route-check__footer {
  margin-top: 8px;
}
</style>
