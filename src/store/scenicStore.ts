import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import defaultScenicList from '@/mock/scenic/list.json'
import defaultCities from '@/mock/scenic/cities.json'
import { getUserStorage, setUserStorage, removeUserStorage, STORAGE_SUFFIX } from '@/utils/storage'
import { DEFAULT_CITY_ID, resolveLocatedCityId } from '@/utils/scenicCity'
import type { CityProfile, ScenicProfile } from '@/types'

function cloneList(list: ScenicProfile[]): ScenicProfile[] {
  return list.map((item) => ({ ...item }))
}

function cloneCities(list: CityProfile[]): CityProfile[] {
  return list.map((item) => ({ ...item }))
}

export const useScenicStore = defineStore('scenic', () => {
  const scenicList = ref<ScenicProfile[]>([])
  const cityList = ref<CityProfile[]>([])
  const currentScenicId = ref<string | null>(null)
  const currentCityId = ref<string | null>(null)
  /** 定位得到的默认城市（无记忆时用） */
  const locatedCityId = ref<string>(DEFAULT_CITY_ID)
  const loaded = ref(false)
  const memberId = ref('')

  const enabledCities = computed(() =>
    cityList.value.filter((item) => item.enabled !== false),
  )

  const enabledScenics = computed(() =>
    scenicList.value.filter((item) => item.enabled !== false),
  )

  const currentScenic = computed(() => {
    if (!currentScenicId.value) return null
    return enabledScenics.value.find((item) => item.scenicId === currentScenicId.value) ?? null
  })

  const currentScenicName = computed(() => currentScenic.value?.name ?? '')

  const currentCity = computed(() => {
    const id = currentCityId.value
    if (!id) return null
    return enabledCities.value.find((item) => item.cityId === id) ?? null
  })

  const currentCityName = computed(() => currentCity.value?.name ?? '')

  const hasScenicSelected = computed(() => Boolean(currentScenic.value))

  const scenicsInCurrentCity = computed(() => {
    const cityId = currentCityId.value
    if (!cityId) return enabledScenics.value
    return enabledScenics.value.filter((item) => item.cityId === cityId)
  })

  function loadCatalog() {
    cityList.value = cloneCities(defaultCities as CityProfile[])
    scenicList.value = cloneList(defaultScenicList as ScenicProfile[])
    loaded.value = true
    return scenicList.value
  }

  function bindMember(nextMemberId: string) {
    memberId.value = nextMemberId
  }

  function readLastScenicId(): string | null {
    if (!memberId.value) return null
    const saved = getUserStorage<string | null>(memberId.value, STORAGE_SUFFIX.LAST_SCENIC_ID, null)
    return typeof saved === 'string' && saved ? saved : null
  }

  function persistLastScenicId(scenicId: string | null) {
    if (!memberId.value) return
    if (!scenicId) {
      removeUserStorage(memberId.value, STORAGE_SUFFIX.LAST_SCENIC_ID)
      return
    }
    setUserStorage(memberId.value, STORAGE_SUFFIX.LAST_SCENIC_ID, scenicId)
  }

  function readLastCityId(): string | null {
    if (!memberId.value) return null
    const saved = getUserStorage<string | null>(memberId.value, STORAGE_SUFFIX.LAST_CITY_ID, null)
    return typeof saved === 'string' && saved ? saved : null
  }

  function persistLastCityId(cityId: string | null) {
    if (!memberId.value) return
    if (!cityId) {
      removeUserStorage(memberId.value, STORAGE_SUFFIX.LAST_CITY_ID)
      return
    }
    setUserStorage(memberId.value, STORAGE_SUFFIX.LAST_CITY_ID, cityId)
  }

  function isValidScenicId(scenicId: string | null | undefined): scenicId is string {
    if (!scenicId) return false
    return enabledScenics.value.some((item) => item.scenicId === scenicId)
  }

  function isValidCityId(cityId: string | null | undefined): cityId is string {
    if (!cityId) return false
    return enabledCities.value.some((item) => item.cityId === cityId)
  }

  function findScenic(scenicId: string): ScenicProfile | undefined {
    return enabledScenics.value.find((item) => item.scenicId === scenicId)
  }

  function scenicsByCity(cityId: string | null | undefined): ScenicProfile[] {
    if (!cityId) return enabledScenics.value
    return enabledScenics.value.filter((item) => item.cityId === cityId)
  }

  /**
   * 解析预览用城市：当前景区所属 > 记忆城市 > 定位默认 > 上海
   */
  function resolvePickerCityId(preferredScenicId?: string | null): string {
    if (!loaded.value) loadCatalog()
    if (preferredScenicId && isValidScenicId(preferredScenicId)) {
      const scenic = findScenic(preferredScenicId)
      if (scenic?.cityId && isValidCityId(scenic.cityId)) return scenic.cityId
    }
    if (currentScenic.value?.cityId && isValidCityId(currentScenic.value.cityId)) {
      return currentScenic.value.cityId
    }
    const remembered = readLastCityId()
    if (isValidCityId(remembered)) return remembered
    if (isValidCityId(locatedCityId.value)) return locatedCityId.value
    return DEFAULT_CITY_ID
  }

  /**
   * 解析当前景区：URL scenicId > lastScenicId（含首页切换）> conversation.scenicId > null
   * 首页与助手共用 lastScenicId；会话景区若与记忆不一致，以记忆为准并在进入助手时开新会话。
   */
  function resolveScenicId(
    urlScenicId?: string | null,
    conversationScenicId?: string | null,
  ): {
    scenicId: string | null
    source: 'url' | 'conversation' | 'memory' | 'none'
    needPicker: boolean
  } {
    if (!loaded.value) loadCatalog()

    if (isValidScenicId(urlScenicId)) {
      return { scenicId: urlScenicId, source: 'url', needPicker: false }
    }

    const remembered = readLastScenicId()
    if (isValidScenicId(remembered)) {
      return { scenicId: remembered, source: 'memory', needPicker: false }
    }

    if (remembered) {
      persistLastScenicId(null)
    }

    if (isValidScenicId(conversationScenicId)) {
      return { scenicId: conversationScenicId, source: 'conversation', needPicker: false }
    }

    return { scenicId: null, source: 'none', needPicker: true }
  }

  function selectCity(cityId: string, options?: { persist?: boolean }) {
    if (!isValidCityId(cityId)) {
      throw new Error('城市不可用或不存在')
    }
    currentCityId.value = cityId
    if (options?.persist !== false) {
      persistLastCityId(cityId)
    }
  }

  function selectScenic(scenicId: string, options?: { persist?: boolean }) {
    if (!isValidScenicId(scenicId)) {
      throw new Error('景区不可用或不存在')
    }
    const scenic = findScenic(scenicId)!
    currentScenicId.value = scenicId
    currentCityId.value = scenic.cityId
    if (options?.persist !== false) {
      persistLastScenicId(scenicId)
      persistLastCityId(scenic.cityId)
    }
  }

  function clearCurrentScenic() {
    currentScenicId.value = null
  }

  /** 异步探测定位城市（不阻塞首屏）；结果写入 locatedCityId */
  async function refreshLocatedCity() {
    try {
      locatedCityId.value = await resolveLocatedCityId()
    } catch {
      locatedCityId.value = DEFAULT_CITY_ID
    }
    return locatedCityId.value
  }

  function getScenicName(scenicId: string | null | undefined): string {
    if (!scenicId) return ''
    return findScenic(scenicId)?.name ?? ''
  }

  return {
    scenicList,
    cityList,
    enabledCities,
    enabledScenics,
    currentScenicId,
    currentCityId,
    currentScenic,
    currentScenicName,
    currentCity,
    currentCityName,
    scenicsInCurrentCity,
    locatedCityId,
    hasScenicSelected,
    loaded,
    loadCatalog,
    bindMember,
    readLastScenicId,
    readLastCityId,
    resolveScenicId,
    resolvePickerCityId,
    selectCity,
    selectScenic,
    clearCurrentScenic,
    isValidScenicId,
    isValidCityId,
    scenicsByCity,
    refreshLocatedCity,
    getScenicName,
  }
})
