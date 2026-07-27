import type { CrowdLevel } from '@/utils/scenicCrowd'
import {
  formatScenicCrowdChatLine,
  getRandomScenicCrowd,
} from '@/utils/scenicCrowd'

/**
 * 欢迎页景区天气（本地 Mock，按 scenicId）
 * 后续可改为 fetch `/api/weather/today?scenicId=`
 */
export interface ScenicWeatherMock {
  /** 气温（摄氏度） */
  tempC: number
  /** 天气现象，如「多云」「晴」 */
  sky: string
  /** 出游提示短句 */
  tip: string
}

/** @deprecated 使用 getScenicWeather / MOCK_SCENIC_WEATHER_BY_ID */
export const MOCK_SCENIC_WEATHER: ScenicWeatherMock = {
  tempC: 26,
  sky: '多云',
  tip: '适合出游',
}

export const MOCK_SCENIC_WEATHER_BY_ID: Record<string, ScenicWeatherMock> = {
  scenic_hlg: {
    tempC: 26,
    sky: '多云',
    tip: '适合出游',
  },
  scenic_hy: {
    tempC: 24,
    sky: '晴',
    tip: '海风偏大，注意防晒',
  },
  scenic_sz_eco: {
    tempC: 27,
    sky: '多云',
    tip: '林间蚊虫较多，建议防蚊',
  },
}

export function getScenicWeather(scenicId?: string | null): ScenicWeatherMock {
  if (scenicId && MOCK_SCENIC_WEATHER_BY_ID[scenicId]) {
    return MOCK_SCENIC_WEATHER_BY_ID[scenicId]!
  }
  return MOCK_SCENIC_WEATHER
}

/** 欢迎气泡天气一行文案 */
export function formatScenicWeatherLine(
  weather: ScenicWeatherMock = MOCK_SCENIC_WEATHER,
  scenicName?: string,
): string {
  const place = scenicName?.trim() || '景区'
  return `今天${place}天气 ${weather.tempC}°C，${weather.sky}，${weather.tip}`
}

/** 按天气 tip + 人流档位给一句综合建议 */
export function buildSuitabilityAdvice(
  weather: ScenicWeatherMock,
  crowdLevel: CrowdLevel,
): string {
  if (crowdLevel === 'busy') {
    return '天气还行，但人流偏多，建议错峰安排热门项目。'
  }
  if (crowdLevel === 'idle') {
    return weather.tip.includes('适合')
      ? '综合来看，今天很适合来玩。'
      : `综合来看，今天人不多，${weather.tip}。`
  }
  return weather.tip.includes('适合')
    ? '综合来看，今天比较适合来玩。'
    : `综合来看，客流正常，${weather.tip}。`
}

/** 「今天适合游玩吗」对话正文：天气 Mock + 随机人流 + 建议 */
export function buildWeatherSuitabilityReply(options?: {
  scenicId?: string | null
  scenicName?: string
}): string {
  const weather = getScenicWeather(options?.scenicId)
  const weatherLine = formatScenicWeatherLine(weather, options?.scenicName)
  const crowd = getRandomScenicCrowd()
  const crowdLine = formatScenicCrowdChatLine(crowd.level)
  const advice = buildSuitabilityAdvice(weather, crowd.level)
  return [
    `🌤 ${weatherLine}`,
    crowdLine,
    '',
    advice,
    '需要的话我可以再帮您看交通指南、入园须知或游玩攻略。',
  ].join('\n')
}
