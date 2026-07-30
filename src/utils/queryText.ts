/**
 * 净化要拼进 URL query 的自由文本（如用户原话）。
 *
 * 演示版生产包在浏览器内用 mockjs 拦截 `/api`，它解析 query 的方式是
 * 「decodeURIComponent + 字符串替换 + JSON.parse」，文本里出现 `&`、`=`、`\`、`"`
 * 或换行/控制字符会直接抛错；本地 Node 中间件按标准方式解析，不会暴露该问题。
 * 关键词匹配用不到这些字符，统一替换为空格，保证本地与打包表现一致。
 */
export function toQuerySafeText(text: string): string {
  return text
    .replace(/[&=\\"\u0000-\u001f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}
