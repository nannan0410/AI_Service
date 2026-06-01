<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { fetchActivities } from '@/api/business'
import type { Activity } from '@/types'

const activities = ref<Activity[]>([])

onMounted(async () => {
  const { data: res } = await fetchActivities()
  if (res.code === 200) activities.value = res.data
})
</script>

<template>
  <div class="page">
    <van-nav-bar title="园区活动" left-arrow fixed placeholder @click-left="$router.back()" />
    <van-cell-group inset class="list">
      <van-cell
        v-for="act in activities"
        :key="act.activityId"
        :title="act.name"
        :label="`${act.location} · ${act.timeRange}`"
      >
        <template #value>
          <van-tag v-for="tag in act.tags" :key="tag" plain type="primary" class="tag">{{ tag }}</van-tag>
        </template>
      </van-cell>
    </van-cell-group>
  </div>
</template>

<style scoped>
.page {
  min-height: 100vh;
  background: #f7f8fa;
}
.list {
  margin-top: 12px;
}
.tag {
  margin-left: 4px;
}
</style>
