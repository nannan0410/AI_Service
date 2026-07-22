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
