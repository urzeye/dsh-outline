import { describe, expect, it } from 'vitest'
import type { ConversationSnapshot } from '@deepseek-ai/dsh-client-runtime/client'
import { buildOutlineItems } from '../src/client/outline-source.ts'

/** 最小可用的 ConversationSnapshot 桩：只填 buildOutlineItems 读取的字段。 */
function snapshotOf(
  nodes: unknown[],
  partial: unknown = null,
): ConversationSnapshot {
  return { nodes, partial } as unknown as ConversationSnapshot
}

describe('buildOutlineItems', () => {
  it('maps user messages and assistant markdown headings in order', () => {
    const snapshot = snapshotOf([
      { kind: 'user', content: [{ type: 'text', text: '如何配置 nginx？' }] },
      {
        kind: 'assistant',
        blocks: [
          { kind: 'reasoning', text: '# 思考不是标题' },
          { kind: 'text', text: '# 结论\n\n正文\n\n## 步骤一' },
          { kind: 'tool-call', callId: '1', name: 'bash', argsRaw: '{}' },
        ],
      },
      { kind: 'steering', content: [{ type: 'text', text: '补充一下' }] },
      { kind: 'assistant', blocks: [{ kind: 'text', text: '## 补充细节' }] },
      { kind: 'tool-result', text: '# 工具输出不是标题' },
    ])
    const items = buildOutlineItems(snapshot)
    expect(items.map((i) => [i.level, i.text])).toEqual([
      [0, '如何配置 nginx？'],
      [1, '结论'],
      [2, '步骤一'],
      [0, '补充一下'],
      [2, '补充细节'],
    ])
    expect(items[0]?.userIndex).toBe(0)
    expect(items[3]?.userIndex).toBe(1)
    expect(items[1]?.headingIndex).toBe(0)
    expect(items[4]?.headingIndex).toBe(2)
  })

  it('includes streaming partial headings flagged as streaming', () => {
    const snapshot = snapshotOf(
      [{ kind: 'user', content: [{ type: 'text', text: '问' }] }],
      { turn: 1, step: 1, blocks: [{ kind: 'text', text: '# 生成中标题' }] },
    )
    const items = buildOutlineItems(snapshot)
    expect(items[1]?.text).toBe('生成中标题')
    expect(items[1]?.streaming).toBe(true)
  })

  it('truncates long user text to the first line', () => {
    const long = `${'很'.repeat(100)}\n第二行`
    const snapshot = snapshotOf([{ kind: 'user', content: [{ type: 'text', text: long }] }])
    const items = buildOutlineItems(snapshot)
    expect(items[0]?.text.length).toBe(80)
    expect(items[0]?.isTruncated).toBe(true)
  })

  it('skips empty user messages and non-content nodes', () => {
    const snapshot = snapshotOf([
      { kind: 'user', content: [{ type: 'image' }] },
      { kind: 'turn-error', message: 'x' },
      { kind: 'context', content: [{ type: 'text', text: '# 上下文不是问题' }] },
    ])
    expect(buildOutlineItems(snapshot)).toEqual([])
  })
})
