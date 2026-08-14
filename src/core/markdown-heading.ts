/**
 * ATX 标题解析（# ~ ######）。纯函数。
 *
 * 边界： fenced code block（``` 或 ~~~）内的 # 行不算标题；
 * 缩进代码块（4 空格）不特殊处理——对话 markdown 里极少出现，
 * 且标题行以 # 开头本身不会是合法缩进代码的常态，保持简单。
 */

export interface MarkdownHeading {
  level: number
  text: string
}

const HEADING_RE = /^#{1,6}[ \t]+(.+?)[ \t]*#*[ \t]*$/
const FENCE_RE = /^\s*(`{3,}|~{3,})/

export function parseMarkdownHeadings(markdown: string): MarkdownHeading[] {
  const out: MarkdownHeading[] = []
  let inFence = false
  for (const line of markdown.split('\n')) {
    if (FENCE_RE.test(line)) {
      inFence = !inFence
      continue
    }
    if (inFence) continue
    const trimmed = line.trimStart()
    if (!trimmed.startsWith('#')) continue
    const m = HEADING_RE.exec(trimmed)
    if (m === null) continue
    const hashes = /^#{1,6}/.exec(trimmed)
    if (hashes === null) continue
    const text = m[1]?.trim() ?? ''
    if (text === '') continue
    out.push({ level: hashes[0].length, text })
  }
  return out
}
