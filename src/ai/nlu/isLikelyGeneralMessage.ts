/** 明显业务意图关键词（命中则不走闲聊快速路径） */
const BUSINESS_HINT =
  /订单|买票|购票|门票|攻略|交通|怎么去|优惠券|券|会员|积分|停车|发票|游玩|入园|套票|两大一小|2大1小|年卡|家庭票|OTA|第三方|订票|查票|路线|出行|指南|领券|新客|优惠组合|项目|活动|玩什么|推荐|待出行|车牌|报销|开票|打卡|签到/

/** 寒暄 / 闲聊短句（无业务关键词时跳过 LLM 语义路由） */
const CHITCHAT_PATTERN =
  /^(hi|hello|hey|yo|ok|okay|thanks|thank you|哈喽|你好|您好|在吗|在么|在不在|早上好|下午好|晚上好|谢谢|感谢|多谢|好的|好哒|嗯|哦|啊|哈+|嗨|喂|拜拜|再见|bye)[!！?？~～\s]*$/i

/**
 * 判断是否像纯闲聊（无落地 Workflow / 业务 Tool 需求）。
 * 用于跳过 LLM Skill 分类，并精简后续对话 Tool 列表。
 */
export function isLikelyGeneralMessage(message: string): boolean {
  const text = message.trim()
  if (!text) return true
  if (BUSINESS_HINT.test(text)) return false
  if (CHITCHAT_PATTERN.test(text)) return true
  // 极短且无中文业务字的输入（如 hi / test）
  if (text.length <= 12 && /^[\x00-\x7F!?~～\s]+$/.test(text)) return true
  return false
}
