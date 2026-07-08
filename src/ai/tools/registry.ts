import type { ToolDefinition } from '@/types'

export const toolRegistry: ToolDefinition[] = [
  {
    name: 'getMemberInfo',
    label: '查询会员信息',
    description: '查询当前登录用户的会员等级、积分、余额等基础信息',
    parameters: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'getOrders',
    label: '查询订单',
    description: '查询当前用户的全部订单，含自营与第三方（OTA/TA）来源，只读展示',
    parameters: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'getCoupons',
    label: '查询优惠券',
    description: '查询当前用户账户中的优惠券列表',
    parameters: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['available', 'used', 'expired'],
          description: '可选，按券状态筛选',
        },
      },
    },
  },
  {
    name: 'getProductCatalog',
    label: '查询票产品',
    description: '查询可售门票产品列表；购票场景请使用 channel=self 仅查自销渠道',
    parameters: {
      type: 'object',
      properties: {
        channel: {
          type: 'string',
          enum: ['self', 'ota', 'ta'],
          description: '销售渠道，默认 self（自销）',
        },
      },
    },
  },
  {
    name: 'generateTravelGuide',
    label: '生成游玩攻略',
    description:
      '生成游玩攻略卡片。scope=full 含交通+入园+项目；scope=recommend 仅推荐路线与项目；scope=in_park 为园内路线（不含交通与入园）',
    parameters: {
      type: 'object',
      properties: {
        scope: {
          type: 'string',
          enum: ['full', 'in_park', 'recommend'],
          description:
            'full=完整出行攻略（交通+入园+项目）；recommend=游玩项目推荐；in_park=园内路线',
        },
      },
    },
  },
  {
    name: 'getContentBlocks',
    label: '查询内容块',
    description: '查询交通指南、入园提醒、FAQ、游玩攻略等独立内容',
    parameters: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          enum: ['traffic', 'entry_notice', 'faq', 'guide', 'strategy'],
          description: '内容类型，不传则返回全部',
        },
      },
    },
  },
  {
    name: 'getScenicActivities',
    label: '查询园区项目',
    description: '查询景区游玩项目/活动列表，可按标签筛选',
    parameters: {
      type: 'object',
      properties: {
        tag: {
          type: 'string',
          description: '可选标签，如 亲子、刺激',
        },
      },
    },
  },
  {
    name: 'getCommonVisitors',
    label: '查询常用游客',
    description: '查询当前账户绑定的常用游客列表，用于购票时选择出行人',
    parameters: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'issueCoupon',
    label: '发放优惠券',
    description: '将券产品发放到当前用户账户；新客可发 cp_prod_new',
    parameters: {
      type: 'object',
      properties: {
        couponProductId: {
          type: 'string',
          description: '券产品 ID，如 cp_prod_new',
        },
      },
      required: ['couponProductId'],
    },
  },
  {
    name: 'createOrderDraft',
    label: '创建订单草稿',
    description: '选定票产品与游客后创建订单草稿，供提交订单假页使用',
    parameters: {
      type: 'object',
      properties: {
        productId: { type: 'string', description: '票产品 ID' },
        ticketType: { type: 'string', description: '票种 ID，如 family_bundle' },
        couponId: { type: 'string', description: '可选，使用的账户券 ID' },
        visitorIdNumbers: {
          type: 'array',
          items: { type: 'string' },
          description: '选中的游客证件号列表',
        },
      },
      required: ['visitorIdNumbers'],
    },
  },
]

export function getToolByName(name: string): ToolDefinition | undefined {
  return toolRegistry.find((t) => t.name === name)
}

export function getToolLabel(name: string): string {
  return getToolByName(name)?.label ?? name
}

export function toOpenAiToolSchemas(tools: ToolDefinition[]) {
  return tools.map((tool) => ({
    type: 'function' as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  }))
}

export function filterTools(names?: string[]): ToolDefinition[] {
  if (names === undefined) return toolRegistry
  if (names.length === 0) return []
  const set = new Set(names)
  return toolRegistry.filter((t) => set.has(t.name))
}

export function getRegisteredToolNames(): string[] {
  return toolRegistry.map((t) => t.name)
}
