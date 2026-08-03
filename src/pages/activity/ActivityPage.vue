<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { fetchActivities } from '@/api/business'
import type { Activity } from '@/types'
import {
  ACTIVITY_CATEGORY_LABELS,
  activityToCardPayload,
  formatQueueLine,
  formatVirtualQueueLine,
} from '@/utils/activityDisplay'

const activities = ref<Activity[]>([])
const activeCategory = ref<string>('')

const categoryOptions = [
  { value: '', label: '全部' },
  { value: 'ride', label: '游乐' },
  { value: 'show', label: '演出' },
  { value: 'dining', label: '餐饮' },
  { value: 'retail', label: '零售' },
]

async function loadActivities() {
  const params = activeCategory.value
    ? { category: activeCategory.value as Activity['category'] }
    : undefined
  const { data: res } = await fetchActivities(params)
  if (res.code === 200) activities.value = res.data
}

onMounted(loadActivities)

function onCategoryChange(name: string | number) {
  activeCategory.value = String(name)
  loadActivities()
}

function activityLabel(act: Activity) {
  const card = activityToCardPayload(act)
  const queue = formatQueueLine(card)
  const vq = formatVirtualQueueLine(card)
  const show =
    act.showStartTimes?.length ? `场次 ${act.showStartTimes.join('/')}` : ''
  return [act.location, act.timeRange, queue, show, vq].filter(Boolean).join(' · ')
}
</script>

<template>
  <div class="page activity-page">
    <van-nav-bar
      title="园区项目"
      left-arrow
      class="activity-page__nav"
      @click-left="$router.back()"
    />
    <van-tabs v-model:active="activeCategory" @change="onCategoryChange">
      <van-tab
        v-for="opt in categoryOptions"
        :key="opt.value"
        :title="opt.label"
        :name="opt.value"
      />
    </van-tabs>
    <van-cell-group inset class="list">
      <van-cell
        v-for="act in activities"
        :key="act.activityId"
        :title="act.name"
        :label="activityLabel(act)"
      >
        <template #value>
          <van-tag plain type="primary" class="tag">
            {{ ACTIVITY_CATEGORY_LABELS[act.category] }}
          </van-tag>
        </template>
      </van-cell>
    </van-cell-group>
  </div>
</template>

<style scoped>
.activity-page {
  width: 100%;
  max-width: 430px;
  min-height: 100vh;
  margin: 0;
  background: #f7f8fa;
}

.activity-page__nav {
  position: sticky;
  top: 0;
  z-index: 100;
}

.list {
  margin-top: 12px;
}

.tag {
  margin-left: 4px;
}
</style>
