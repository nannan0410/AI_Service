import { toPng } from 'html-to-image'
import type { TravelGuidePayload } from '@/types'

function buildGuideImageFilename(payload: TravelGuidePayload): string {
  const date = payload.visitDate?.replace(/-/g, '') ?? 'guide'
  return `出行攻略-${date}.png`
}

/** 将攻略卡片 DOM 截图为 PNG 并触发浏览器下载（H5 演示） */
export async function downloadGuideCardImage(
  element: HTMLElement,
  payload: TravelGuidePayload,
): Promise<void> {
  const dataUrl = await toPng(element, {
    cacheBust: true,
    pixelRatio: 2,
    backgroundColor: '#ffffff',
  })

  const link = document.createElement('a')
  link.download = buildGuideImageFilename(payload)
  link.href = dataUrl
  link.click()
}
