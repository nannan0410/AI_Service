/**
 * 欢迎页景区天气（本地 Mock）
 * 后续可改为 fetch `/api/weather/today`，映射为同一结构即可。
 */
export interface ScenicWeatherMock {
  /** 气温（摄氏度） */
  tempC: number
  /** 天气现象，如「多云」「晴」 */
  sky: string
  /** 出游提示短句 */
  tip: string
}

export const MOCK_SCENIC_WEATHER: ScenicWeatherMock = {
  tempC: 26,
  sky: '多云',
  tip: '适合出游',
}

/** 欢迎气泡天气一行文案 */
export function formatScenicWeatherLine(
  weather: ScenicWeatherMock = MOCK_SCENIC_WEATHER,
): string {
  return `今天景区天气 ${weather.tempC}°C，${weather.sky}，${weather.tip}`
}
