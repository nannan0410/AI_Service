<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { CityProfile, ScenicProfile } from '@/types'

const props = defineProps<{
  show: boolean
  cities: CityProfile[]
  scenics: ScenicProfile[]
  currentScenicId: string | null
  /** 打开弹层时默认选中的城市 */
  initialCityId?: string | null
  /** 集团入口首次必选时不可点遮罩关闭 */
  required?: boolean
  title?: string
}>()

const emit = defineEmits<{
  'update:show': [value: boolean]
  select: [scenicId: string]
  'update:cityId': [cityId: string]
}>()

const draftCityId = ref<string | null>(null)

const enabledCities = computed(() =>
  props.cities.filter((item) => item.enabled !== false),
)

const filteredScenics = computed(() => {
  const cityId = draftCityId.value
  const list = props.scenics.filter((item) => item.enabled !== false)
  if (!cityId) return list
  return list.filter((item) => item.cityId === cityId)
})

function syncDraftCity() {
  if (props.initialCityId && enabledCities.value.some((c) => c.cityId === props.initialCityId)) {
    draftCityId.value = props.initialCityId
    return
  }
  if (props.currentScenicId) {
    const scenic = props.scenics.find((item) => item.scenicId === props.currentScenicId)
    if (scenic?.cityId && enabledCities.value.some((c) => c.cityId === scenic.cityId)) {
      draftCityId.value = scenic.cityId
      return
    }
  }
  draftCityId.value = enabledCities.value[0]?.cityId ?? null
}

watch(
  () => props.show,
  (visible) => {
    if (visible) syncDraftCity()
  },
)

function onClose() {
  emit('update:show', false)
}

function onSelectCity(cityId: string) {
  draftCityId.value = cityId
  emit('update:cityId', cityId)
}

function onSelect(scenic: ScenicProfile) {
  if (scenic.enabled === false) return
  emit('select', scenic.scenicId)
}
</script>

<template>
  <van-popup
    :show="show"
    position="bottom"
    round
    :close-on-click-overlay="!required"
    :style="{ maxHeight: '82%' }"
    @update:show="emit('update:show', $event)"
  >
    <div class="scenic-picker">
      <header class="scenic-picker__head">
        <h3 class="scenic-picker__title">{{ title || '选择服务景区' }}</h3>
        <button
          v-if="!required"
          type="button"
          class="scenic-picker__close"
          aria-label="关闭"
          @click="onClose"
        >
          <van-icon name="cross" size="18" />
        </button>
      </header>
      <p v-if="required" class="scenic-picker__hint">请先选择城市与景区，再开始对话</p>

      <div class="scenic-picker__cities" role="tablist" aria-label="选择城市">
        <button
          v-for="city in enabledCities"
          :key="city.cityId"
          type="button"
          class="scenic-picker__city"
          :class="{ 'scenic-picker__city--active': city.cityId === draftCityId }"
          role="tab"
          :aria-selected="city.cityId === draftCityId"
          @click="onSelectCity(city.cityId)"
        >
          {{ city.name }}
        </button>
      </div>

      <ul class="scenic-picker__list">
        <li
          v-for="scenic in filteredScenics"
          :key="scenic.scenicId"
          class="scenic-picker__item"
          :class="{
            'scenic-picker__item--active': scenic.scenicId === currentScenicId,
            'scenic-picker__item--disabled': scenic.enabled === false,
          }"
          @click="onSelect(scenic)"
        >
          <img
            :src="scenic.coverUrl"
            :alt="scenic.name"
            class="scenic-picker__cover"
          />
          <div class="scenic-picker__meta">
            <strong class="scenic-picker__name">{{ scenic.name }}</strong>
            <p v-if="scenic.description" class="scenic-picker__desc">
              {{ scenic.description }}
            </p>
          </div>
          <van-icon
            v-if="scenic.scenicId === currentScenicId"
            name="success"
            class="scenic-picker__check"
            color="var(--chat-primary, #07c160)"
          />
        </li>
      </ul>
      <van-empty
        v-if="!filteredScenics.length"
        description="该城市暂无可服务景区"
        image-size="72"
      />
    </div>
  </van-popup>
</template>

<style scoped>
.scenic-picker {
  padding: 16px 16px calc(16px + env(safe-area-inset-bottom));
  background: #f7f8fa;
}

.scenic-picker__head {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 28px;
  margin-bottom: 8px;
}

.scenic-picker__title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #323233;
}

.scenic-picker__close {
  position: absolute;
  right: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 32px;
  height: 32px;
  padding: 0;
  border: none;
  border-radius: 50%;
  color: #969799;
  background: #fff;
}

.scenic-picker__hint {
  margin: 0 0 12px;
  font-size: 13px;
  line-height: 1.4;
  color: #969799;
  text-align: center;
}

.scenic-picker__cities {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}

.scenic-picker__city {
  padding: 6px 14px;
  border: 1px solid #ebedf0;
  border-radius: 999px;
  background: #fff;
  color: #646566;
  font-size: 13px;
  line-height: 1.2;
  cursor: pointer;
}

.scenic-picker__city--active {
  border-color: var(--chat-primary, #07c160);
  background: var(--chat-primary-light, #e8f8ef);
  color: var(--chat-primary-dark, #06ad56);
  font-weight: 600;
}

.scenic-picker__list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.scenic-picker__item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px;
  border-radius: 14px;
  background: #fff;
  border: 1.5px solid transparent;
  box-shadow: 0 4px 14px rgba(58, 87, 112, 0.06);
  cursor: pointer;
}

.scenic-picker__item--active {
  border-color: var(--chat-primary, #07c160);
  background: var(--chat-primary-light, #e8f8ef);
}

.scenic-picker__item--disabled {
  opacity: 0.5;
  pointer-events: none;
}

.scenic-picker__item:active {
  opacity: 0.92;
}

.scenic-picker__cover {
  flex-shrink: 0;
  width: 88px;
  height: 56px;
  object-fit: cover;
  border-radius: 10px;
  background: #ebedf0;
}

.scenic-picker__meta {
  flex: 1;
  min-width: 0;
}

.scenic-picker__name {
  display: block;
  font-size: 15px;
  font-weight: 600;
  color: #323233;
  line-height: 1.3;
}

.scenic-picker__desc {
  margin: 4px 0 0;
  font-size: 12px;
  line-height: 1.35;
  color: #969799;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.scenic-picker__check {
  flex-shrink: 0;
  font-size: 20px;
}
</style>
