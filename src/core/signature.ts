/** djb2 hash：将任意长度字符串压缩为 8 位十六进制字符串（移植自 Ophel）。 */
export function djb2Hash(str: string): string {
  let hash = 5381
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) >>> 0
  }
  return hash.toString(16).padStart(8, '0')
}

/**
 * 大纲项签名：djb2(level:text) + 同签名出现序号。
 * 内容小幅编辑（同层级同文本）不丢收藏；重复标题按出现次序消歧。
 */
export function itemSignature(level: number, text: string, occurrence: number): string {
  return `${djb2Hash(`${level}:${text}`)}:${occurrence}`
}
