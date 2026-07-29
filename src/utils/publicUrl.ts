/**
 * 将以 `/` 开头的静态资源路径加上 Vite `base`（子目录部署时必需）。
 * 已是 http(s)/data/blob，或已带 base 前缀的路径会原样返回。
 */
export function withBaseUrl(url: string | undefined | null): string {
  if (!url) return ''
  if (/^(https?:|data:|blob:)/i.test(url)) return url
  const base = import.meta.env.BASE_URL || '/'
  if (url.startsWith(base)) return url
  if (url.startsWith('/')) return `${base}${url.slice(1)}`
  return `${base}${url}`
}
