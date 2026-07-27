/** 打开地图 / 查看位置（不负责项目推荐排序） */
export function shouldRunMapGuideWorkflow(message: string): boolean {
  const text = message.trim()
  if (!text) return false

  if (/打开地图|查看地图|园区地图|导览地图|看下地图|看一下地图/.test(text)) {
    return true
  }
  if (/查看位置|在地图上看|地图上看看|地图里看/.test(text)) {
    return true
  }
  if (/^导航$|打开导览|用地图/.test(text)) {
    return true
  }
  return false
}
