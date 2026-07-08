/** 对话内服务点评 → review_service Workflow */
export function shouldRunReviewWorkflow(message: string): boolean {
  const text = message.trim()
  if (!text) return false

  if (/怎么点评|如何评价|点评教程/.test(text)) return false

  return (
    /我要点评|写评价|服务点评|满意度调查|满意度/.test(text) ||
    /服务怎么样|体验怎么样/.test(text) ||
    (/点评|评价/.test(text) && !/演出|项目|活动|景点/.test(text))
  )
}
