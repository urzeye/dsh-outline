/**
 * 数据源适配层：ConversationSnapshot → 扁平大纲项。
 * 本文件是 core 之外唯一依赖 DSH 数据契约的映射模块（类型仅 type-only import，
 * 构建期擦除）。
 *
 * 映射规则（与 docs/technical-plan.md §2 一致）：
 * - user / steering 消息 → level 0 用户问题节点；
 * - assistant 消息的 text block → markdown 标题（reasoning/tool-call 不进大纲）；
 * - partial（流式中）的 text block 同样解析，标记 streaming；
 * - 其余节点类型（tool-result/context/turn-error/...）一律排除。
 */
import type { ConversationSnapshot } from '@deepseek-ai/dsh-client-runtime/client'
import { parseMarkdownHeadings } from '../core/markdown-heading.ts'
import type { OutlineItem } from '../core/types.ts'

/** 用户问题展示的最大字符数（超出截断 + 省略感由 UI 负责）。 */
const MAX_USER_TEXT = 80

interface TextBlockLike {
  type: string
  text?: string
}

function userTextOf(content: readonly TextBlockLike[]): string {
  const raw = content
    .filter((block) => block.type === 'text' && typeof block.text === 'string')
    .map((block) => block.text as string)
    .join('\n')
    .trim()
  // 首行优先：问题摘要不跨行
  return raw.split('\n', 1)[0]?.trim() ?? ''
}

export type SourceItem = Omit<OutlineItem, 'id'>

export function buildOutlineItems(snapshot: ConversationSnapshot): SourceItem[] {
  const items: SourceItem[] = []
  let userIndex = 0
  let headingIndex = 0

  const pushHeadings = (markdown: string, streaming: boolean): void => {
    for (const heading of parseMarkdownHeadings(markdown)) {
      items.push({
        level: heading.level,
        text: heading.text,
        headingIndex: headingIndex++,
        ...(streaming ? { streaming: true } : {}),
      })
    }
  }

  for (const node of snapshot.nodes) {
    if (node.kind === 'user' || node.kind === 'steering') {
      const text = userTextOf(node.content as readonly TextBlockLike[])
      if (text === '') continue
      items.push({
        level: 0,
        text: text.length > MAX_USER_TEXT ? text.slice(0, MAX_USER_TEXT) : text,
        isUserQuery: true,
        userIndex: userIndex++,
        ...(text.length > MAX_USER_TEXT ? { isTruncated: true } : {}),
      })
      continue
    }
    if (node.kind === 'assistant') {
      for (const block of node.blocks) {
        if (block.kind === 'text') pushHeadings(block.text, false)
      }
    }
  }

  // 流式中的 assistant 片段：标题随生成实时出现
  if (snapshot.partial !== null) {
    for (const block of snapshot.partial.blocks) {
      if (block.kind === 'text') pushHeadings(block.text, true)
    }
  }

  return items
}
