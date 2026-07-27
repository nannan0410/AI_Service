import type { MockMethod } from 'vite-plugin-mock'
import mapConfigs from '../src/mock/map/config.json'
import mapPois from '../src/mock/map/pois.json'
import { getScenicIdFromHeaders } from './rules'
import { DEFAULT_SCENIC_ID } from '../src/utils/scenicScope'

type MapConfigRow = {
  scenicId: string
  mapImageUrl: string
  coordinateSpace: 'percent' | 'pixel'
  enabled?: boolean
}

type MapPoiRow = {
  poiId: string
  scenicId: string
  activityId?: string
  name: string
  mapX: number
  mapY: number
  area?: string
  poiType: string
}

function resolveScenicId(
  headers: Record<string, unknown>,
  query: Record<string, string>,
): string {
  return (
    (typeof query.scenicId === 'string' && query.scenicId.trim()) ||
    getScenicIdFromHeaders(headers) ||
    DEFAULT_SCENIC_ID
  )
}

export default [
  {
    url: '/api/map/config',
    method: 'get',
    response: ({
      headers,
      query,
    }: {
      headers: Record<string, unknown>
      query: Record<string, string>
    }) => {
      const scenicId = resolveScenicId(headers, query)
      const config = (mapConfigs as MapConfigRow[]).find(
        (item) => item.scenicId === scenicId && item.enabled !== false,
      )
      if (!config) {
        return { code: 200, data: null }
      }
      return { code: 200, data: config }
    },
  },
  {
    url: '/api/map/pois',
    method: 'get',
    response: ({
      headers,
      query,
    }: {
      headers: Record<string, unknown>
      query: Record<string, string>
    }) => {
      const scenicId = resolveScenicId(headers, query)
      const list = (mapPois as MapPoiRow[]).filter((item) => item.scenicId === scenicId)
      return { code: 200, data: list }
    },
  },
  {
    /** Phase 3：契约占位，Demo 不返回真实游园线节点 */
    url: '/api/map/routes',
    method: 'get',
    response: ({
      headers,
      query,
    }: {
      headers: Record<string, unknown>
      query: Record<string, string>
    }) => {
      const scenicId = resolveScenicId(headers, query)
      const hasMap = (mapConfigs as MapConfigRow[]).some(
        (item) => item.scenicId === scenicId && item.enabled !== false,
      )
      return {
        code: 200,
        data: [
          {
            scenicId,
            routeId: `route_placeholder_${scenicId}`,
            name: '固定游园线（契约占位）',
            demoImplemented: false,
            note: hasMap
              ? 'Demo 不实现真实固定线路；落地对接导览中台 routes，节点序列绑定 mapPoiId'
              : '当前景区无导览底图；落地仍可配置游园线，与地图能力①独立',
            nodeCount: 0,
          },
        ],
      }
    },
  },
  {
    /** Phase 3：契约占位，Demo 不算 from→to 子路径 */
    url: '/api/map/plan',
    method: 'get',
    response: ({
      headers,
      query,
    }: {
      headers: Record<string, unknown>
      query: Record<string, string>
    }) => {
      const scenicId = resolveScenicId(headers, query)
      const from = typeof query.from === 'string' ? query.from : ''
      const to = typeof query.to === 'string' ? query.to : ''
      return {
        code: 200,
        data: {
          scenicId,
          from: from || undefined,
          to: to || undefined,
          supported: false,
          message:
            'Demo 不启用真实路径规划；落地可由导览服务根据 from/to（mapPoiId）返回子路径节点',
          pathNodeIds: [],
        },
      }
    },
  },
] as MockMethod[]
