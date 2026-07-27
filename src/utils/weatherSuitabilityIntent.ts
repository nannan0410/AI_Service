/**
 * 「今天适合游玩吗」— 天气 + 人流 Mock，不走通用 LLM
 */
export function shouldRunWeatherSuitabilityWorkflow(message: string): boolean {
  const text = message.trim()
  if (!text) return false
  return (
    /今天适合(?:来(?:景区)?)?游玩吗|适合(?:来)?游玩吗|适合出游吗|适合来玩吗/.test(
      text,
    ) ||
    /天气和人流|人流怎么样|客流怎么样|今天人流|今天客流/.test(text) ||
    /今天(?:景区)?天气(?:怎么样|如何)|天气怎么样|查(?:一下)?天气/.test(text) ||
    /结合天气.*(?:游玩|玩法)|天气.*(?:和|与).*人流/.test(text)
  )
}
